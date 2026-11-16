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

const call = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
  const { base, token } = settings();
  const response = await fetch(`${base}${path}`, {
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

export const realtimeKit = {
  createMeeting: (meeting: { title: string; recap: boolean; record: boolean }) =>
    call<{ id: string }>("/meetings", "POST", {
      title: meeting.title,
      record_on_start: meeting.record,
      transcribe_on_end: meeting.recap,
      summarize_on_end: meeting.recap,
      ai_config: meeting.recap
        ? {
            summarization: {
              summary_type: "team_meeting",
              text_format: "plain_text",
              word_limit: 300,
            },
          }
        : undefined,
    }),
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
  kick: (meetingId: string, customParticipantIds: string[]) =>
    call<unknown>(`/meetings/${meetingId}/active-session/kick`, "POST", {
      custom_participant_ids: customParticipantIds,
    }),
  kickAll: (meetingId: string) =>
    call<unknown>(`/meetings/${meetingId}/active-session/kick-all`, "POST", {}),
  listPresets: () => call<{ name: string }[]>("/presets", "GET"),
  createPreset: (preset: unknown) => call<{ id: string }>("/presets", "POST", preset),
  createWebhook: (webhook: { name: string; url: string; events: string[] }) =>
    call<{ id: string }>("/webhooks", "POST", { ...webhook, enabled: true }),
};
