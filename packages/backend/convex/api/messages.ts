import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import { enforceRateLimit, enforceSlowMode } from "../lib/rateLimits";
import { meetingMutation, meetingQuery, zPaginationOpts } from "../lib/functions";
import { canControlCall } from "../models/calls";
import { findMeetingAccess, requireMeetingMember } from "../models/meetingAccess";
import { queueMessageCheck } from "../models/moderationQueue";
import { isPublicRoom, requireNotBanned } from "../models/roomAccess";
import { listMessages, sendMessage, toggleReaction } from "../models/messages";
import { zReactionEmoji } from "../tables/messageReactions";
import { zMessage } from "../tables/messages";

export const list = meetingQuery({
  args: { meetingId: zid("meetings"), paginationOpts: zPaginationOpts },
  handler: async (ctx, { meetingId, paginationOpts }) => {
    const access = await findMeetingAccess(ctx, meetingId, ctx.userId);
    if (!access) return { page: [], isDone: true, continueCursor: "" };
    const { meeting, member } = access;
    return listMessages(ctx, meetingId, paginationOpts, member.userId, isPublicRoom(meeting));
  },
});

export const send = meetingMutation({
  args: { meetingId: zid("meetings"), body: zMessage.shape.body },
  handler: async (ctx, { meetingId, body }) => {
    const { meeting, member } = await requireMeetingMember(ctx, meetingId, ctx.userId);
    if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
    const open = isPublicRoom(meeting);
    if (open) await requireNotBanned(ctx, meeting.orgId, ctx.userId);
    await enforceRateLimit(ctx, "chat", ctx.userId);
    const slowModeSeconds = meeting.slowModeSeconds ?? 0;
    if (slowModeSeconds > 0 && !(await canControlCall(ctx, meeting, member))) {
      await enforceSlowMode(ctx, member._id, slowModeSeconds);
    }
    const messageId = await sendMessage(ctx, meetingId, member._id, body, open || undefined);
    if (open) await queueMessageCheck(ctx, messageId);
    return messageId;
  },
});

export const react = meetingMutation({
  args: { messageId: zid("messages"), emoji: zReactionEmoji },
  handler: async (ctx, { messageId, emoji }) => {
    await enforceRateLimit(ctx, "reaction", ctx.userId);
    return toggleReaction(ctx, ctx.userId, messageId, emoji);
  },
});
