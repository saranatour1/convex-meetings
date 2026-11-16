import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeetingMember = z.object({
  meetingId: zid("meetings"),
  userId: zid("users"),
  response: z.enum(["pending", "accepted", "declined"]),
});

export const meetingMembers = defineTable(zodToConvexFields(zMeetingMember.shape))
  .index("by_meeting_and_user", ["meetingId", "userId"])
  .index("by_user", ["userId"]);
