import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { WEBHOOK_PATH } from "./internal/realtime";
import { isSignedBy, realtimePublicKey } from "./lib/webhooks";
import type { RealtimeEvent } from "./models/meetings";

const downloadText = (url: string | undefined) =>
  url
    ? fetch(url)
        .then((response) => (response.ok ? response.text() : undefined))
        .catch(() => undefined)
    : Promise.resolve(undefined);

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
    await ctx.runMutation(internal.internal.realtime.recordEvent, { event: { ...event, summary } });
    return new Response(null, { status: 200 });
  }),
});

export default http;
