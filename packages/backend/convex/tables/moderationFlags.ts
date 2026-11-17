import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zFlagKind = z.enum(["message", "name", "frame", "summary"]);
export const zFlagAction = z.enum(["removed", "strike", "ban", "kick", "watch", "review"]);

export const zModerationFlag = z.object({
  orgId: zid("organizations"),
  meetingId: zid("meetings"),
  userId: zid("users"),
  memberId: zid("meetingMembers"),
  kind: zFlagKind,
  reason: z.string().max(40),
  action: zFlagAction,
  scores: z.record(z.string().max(40), z.number()),
  body: z.string().max(4000).optional(),
  storageId: zid("_storage").optional(),
  reporterId: zid("meetingMembers").optional(),
  resolvedAt: z.number().optional(),
  resolvedBy: zid("users").optional(),
});

export const moderationFlags = defineTable(zodToConvexFields(zModerationFlag.shape))
  .index("by_org", ["orgId"])
  .index("by_org_and_user", ["orgId", "userId"])
  .index("by_meeting", ["meetingId"])
  .index("by_meeting_and_member", ["meetingId", "memberId"]);
