import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import { enforceRateLimit } from "../lib/rateLimits";
import { meetingMutation, meetingQuery, zPaginationOpts } from "../lib/functions";
import { requireMeetingMember } from "../models/meetingAccess";
import { listMessages, sendMessage, toggleReaction } from "../models/messages";
import { zReactionEmoji } from "../tables/messageReactions";
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

export const react = meetingMutation({
  args: { messageId: zid("messages"), emoji: zReactionEmoji },
  handler: async (ctx, { messageId, emoji }) => {
    await enforceRateLimit(ctx, "reaction", ctx.userId);
    return toggleReaction(ctx, ctx.userId, messageId, emoji);
  },
});
