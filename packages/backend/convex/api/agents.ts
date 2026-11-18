import { zid } from "convex-helpers/server/zod4";
import { meetingMutation } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { attendAsAgent, leaveAsAgent } from "../models/agents";

export const attend = meetingMutation({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    await enforceRateLimit(ctx, "agentAttend", ctx.userId);
    return attendAsAgent(ctx, ctx.userId, meetingId);
  },
});

export const leave = meetingMutation({
  args: { meetingId: zid("meetings") },
  handler: (ctx, { meetingId }) => leaveAsAgent(ctx, ctx.userId, meetingId),
});
