import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import { enforceRateLimit } from "../lib/rateLimits";
import { meetingMutation, meetingQuery, zPaginationOpts } from "../lib/functions";
import { listMessages, requireMeetingMember, sendMessage } from "../models/meetings";
import { zMessage } from "../tables/messages";

export const list = meetingQuery({
  args: { meetingId: zid("meetings"), paginationOpts: zPaginationOpts },
  handler: async (ctx, { meetingId, paginationOpts }) => {
    await requireMeetingMember(ctx, meetingId, ctx.userId);
    return listMessages(ctx, meetingId, paginationOpts, ctx.userId);
  },
});

export const send = meetingMutation({
  args: { meetingId: zid("meetings"), body: zMessage.shape.body },
  handler: async (ctx, { meetingId, body }) => {
    const { member } = await requireMeetingMember(ctx, meetingId, ctx.userId);
    if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
    await enforceRateLimit(ctx, "chat", ctx.userId);
    return sendMessage(ctx, meetingId, member._id, body);
  },
});
