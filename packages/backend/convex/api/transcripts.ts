import { zid } from "convex-helpers/server/zod4";
import { meetingMutation, meetingQuery, zPaginationOpts } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { addTranscriptLine, listLiveTranscript } from "../models/transcripts";
import { zTranscriptLine } from "../tables/transcriptLines";

export const add = meetingMutation({
  args: { meetingId: zid("meetings"), text: zTranscriptLine.shape.text },
  handler: async (ctx, { meetingId, text }) => {
    await enforceRateLimit(ctx, "transcript", ctx.userId);
    return addTranscriptLine(ctx, ctx.userId, meetingId, text);
  },
});

export const live = meetingQuery({
  args: { meetingId: zid("meetings"), paginationOpts: zPaginationOpts },
  handler: (ctx, { meetingId, paginationOpts }) =>
    listLiveTranscript(ctx, ctx.userId, meetingId, paginationOpts),
});
