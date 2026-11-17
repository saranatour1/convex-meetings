import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import { authedMutation, authedQuery, zPaginationOpts } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { admitRequest, askAsMember, denyRequest, listWaiting } from "../models/joinRequests";

export const ask = authedMutation({
  args: { code: z.string().max(20) },
  handler: async (ctx, { code }) => {
    await enforceRateLimit(ctx, "joinAsk", ctx.userId);
    await askAsMember(ctx, ctx.userId, code);
  },
});

export const waiting = authedQuery({
  args: { meetingId: zid("meetings"), paginationOpts: zPaginationOpts },
  handler: (ctx, { meetingId, paginationOpts }) =>
    listWaiting(ctx, ctx.userId, meetingId, paginationOpts),
});

export const admit = authedMutation({
  args: { requestId: zid("joinRequests") },
  handler: (ctx, { requestId }) => admitRequest(ctx, ctx.userId, requestId),
});

export const deny = authedMutation({
  args: { requestId: zid("joinRequests") },
  handler: (ctx, { requestId }) => denyRequest(ctx, ctx.userId, requestId),
});
