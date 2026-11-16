import { httpRouter } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { env, httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { WEBHOOK_PATH } from "./internal/realtime";
import { realtimeKit } from "./lib/realtimekit";
import { isSignedBy, realtimePublicKey } from "./lib/webhooks";
import type { RealtimeEvent } from "./models/callSessions";

const downloadText = (url: string | undefined) =>
  url
    ? fetch(url)
        .then((response) => (response.ok ? response.text() : undefined))
        .catch(() => undefined)
    : Promise.resolve(undefined);

const saveTranscript = async (
  store: (blob: Blob) => Promise<Id<"_storage">>,
  sessionId?: string,
) => {
  if (!sessionId) return undefined;
  try {
    const { transcript_download_url } = await realtimeKit.sessionTranscriptUrl(sessionId);
    const response = await fetch(transcript_download_url);
    if (!response.ok) return undefined;
    return await store(new Blob([await response.text()], { type: "application/json" }));
  } catch {
    return undefined;
  }
};

const http = httpRouter();

http.route({
  path: WEBHOOK_PATH,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("rtk-signature");
    if (!signature || !(await isSignedBy(await realtimePublicKey(), body, signature))) {
      return new Response("Invalid signature", { status: 401 });
    }
    const event = JSON.parse(body) as RealtimeEvent;
    const summary =
      event.event === "meeting.summary" ? await downloadText(event.summaryDownloadUrl) : undefined;
    const transcriptId =
      event.event === "meeting.transcript"
        ? await saveTranscript((blob) => ctx.storage.store(blob), event.meeting?.sessionId)
        : undefined;
    const fileName = event.recording?.outputFileName;
    const recordingKey = fileName
      ? `${(env.RECORDINGS_PATH ?? "").replace(/^\/+/, "")}${fileName}`
      : undefined;
    await ctx.runMutation(internal.internal.realtime.recordEvent, {
      event: { ...event, summary, transcriptId, recordingKey },
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
