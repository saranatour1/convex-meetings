import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMessage = z.object({
  meetingId: zid("meetings"),
  meetingMemberId: zid("meetingMembers"),
  body: z.string().trim().min(1).max(4000),
  pending: z.boolean().optional(),
});

export const messages = defineTable(zodToConvexFields(zMessage.shape)).index("by_meeting", [
  "meetingId",
]);
