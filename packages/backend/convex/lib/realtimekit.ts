import { ConvexError } from "convex/values";
import { env } from "../_generated/server";

const settings = () => {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const appId = env.REALTIMEKIT_APP_ID;
  const token = env.REALTIMEKIT_API_TOKEN;
  if (!accountId || !appId || !token) {
    throw new ConvexError(
      "Video calls aren't set up yet: set REALTIMEKIT_APP_ID and REALTIMEKIT_API_TOKEN on the deployment",
    );
  }
  return {
    base: `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}`,
    token,
  };
};

const TIMEOUT_MS = 15_000;

const send = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    throw new ConvexError("The video service didn't answer in time. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
};

const call = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
  const { base, token } = settings();
  const response = await send(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    errors?: unknown;
  };
  if (!response.ok || json.success === false) {
    throw new Error(
      `RealtimeKit ${method} ${path} failed: ${response.status} ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json.data as T;
};

export type MeetingConfig = { recap: boolean; record: boolean; maxRecordingSeconds: number };

const meetingConfig = (config: MeetingConfig) => ({
  record_on_start: config.record,
  transcribe_on_end: config.recap,
  summarize_on_end: config.recap,
  recording_config: { max_seconds: Math.min(86_400, Math.max(60, config.maxRecordingSeconds)) },
  ai_config: config.recap
    ? {
        summarization: {
          summary_type: "team_meeting",
          text_format: "plain_text",
          word_limit: 300,
        },
      }
    : undefined,
});

export const realtimeKit = {
  createMeeting: (meeting: MeetingConfig & { title: string }) =>
    call<{ id: string }>("/meetings", "POST", { title: meeting.title, ...meetingConfig(meeting) }),
  updateMeeting: (meetingId: string, config: MeetingConfig) =>
    call<unknown>(`/meetings/${meetingId}`, "PATCH", meetingConfig(config)),
  stopRecordings: async (meetingId: string) => {
    const recordings = await call<{ id: string }[]>(
      `/recordings?meeting_id=${encodeURIComponent(meetingId)}&status=RECORDING`,
      "GET",
    );
    for (const recording of recordings) {
      await call<unknown>(`/recordings/${recording.id}`, "PUT", { action: "stop" });
    }
  },
  setLiveText: async (presetNames: string[], on: boolean) => {
    const presets = await call<{ id: string; name: string }[]>("/presets", "GET");
    for (const preset of presets.filter((p) => presetNames.includes(p.name))) {
      await call<unknown>(`/presets/${preset.id}`, "PATCH", {
        permissions: { transcription_enabled: on },
      });
    }
  },
  deactivateMeeting: (meetingId: string) =>
    call<unknown>(`/meetings/${meetingId}`, "PATCH", { status: "INACTIVE" }),
  addParticipant: (
    meetingId: string,
    participant: { customId: string; presetName: string; name: string; picture?: string },
  ) =>
    call<{ id: string; token: string }>(`/meetings/${meetingId}/participants`, "POST", {
      custom_participant_id: participant.customId,
      preset_name: participant.presetName,
      name: participant.name,
      picture: participant.picture,
    }),
  refreshToken: (meetingId: string, participantId: string) =>
    call<{ token: string }>(
      `/meetings/${meetingId}/participants/${participantId}/token`,
      "POST",
      {},
    ),
  sessionTranscriptUrl: (sessionId: string) =>
    call<{ transcript_download_url: string }>(
      `/sessions/${sessionId}/transcript?format=JSON`,
      "GET",
    ),
  kick: (meetingId: string, participantIds: string[]) =>
    call<unknown>(`/meetings/${meetingId}/active-session/kick`, "POST", {
      participant_ids: participantIds,
    }),
  kickAll: (meetingId: string) =>
    call<unknown>(`/meetings/${meetingId}/active-session/kick-all`, "POST", {}),
  listPresets: () => call<{ name: string }[]>("/presets", "GET"),
  createPreset: (preset: unknown) => call<{ id: string }>("/presets", "POST", preset),
  createWebhook: (webhook: { name: string; url: string; events: string[] }) =>
    call<{ id: string }>("/webhooks", "POST", { ...webhook, enabled: true }),
};
