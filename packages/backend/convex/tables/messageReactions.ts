import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "👀"] as const;

export const zReactionEmoji = z.enum(REACTION_EMOJIS);

export const zMessageReaction = z.object({
  messageId: zid("messages"),
  meetingId: zid("meetings"),
  memberId: zid("meetingMembers"),
  emoji: zReactionEmoji,
});

export const messageReactions = defineTable(zodToConvexFields(zMessageReaction.shape))
  .index("by_message_and_member", ["messageId", "memberId"])
  .index("by_meeting", ["meetingId"]);
