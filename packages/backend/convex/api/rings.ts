import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import { authedMutation, authedQuery, orgMutation } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { zTimeZone } from "../lib/time";
import { answerRing, cancelRing, incomingRing, outgoingRing, startRing } from "../models/rings";

export const ring = orgMutation({
  args: { calleeId: zid("users"), timeZone: zTimeZone },
  handler: async (ctx, { orgId, calleeId, timeZone }) => {
    ctx.requirePermission("createMeetings");
    await enforceRateLimit(ctx, "ring", ctx.userId);
    return startRing(ctx, {
      orgId,
      callerId: ctx.userId,
      calleeId,
      timeZone,
      canManageMeetings: ctx.can("manageMeetings"),
    });
  },
});

export const incoming = authedQuery({
  args: {},
  handler: (ctx) => incomingRing(ctx, ctx.userId),
});

export const outgoing = authedQuery({
  args: { meetingId: zid("meetings") },
  handler: (ctx, { meetingId }) => outgoingRing(ctx, ctx.userId, meetingId),
});

export const answer = authedMutation({
  args: { ringId: zid("rings"), accept: z.boolean() },
  handler: (ctx, { ringId, accept }) => answerRing(ctx, ctx.userId, ringId, accept),
});

export const cancel = authedMutation({
  args: { ringId: zid("rings") },
  handler: (ctx, { ringId }) => cancelRing(ctx, ctx.userId, ringId),
});
