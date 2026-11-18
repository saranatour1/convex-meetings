import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zAgentPresence = z.object({
  meetingId: zid("meetings"),
  sessionId: zid("meetingSessions"),
  memberId: zid("meetingMembers"),
  seenAt: z.number(),
});

export const agentPresence = defineTable(zodToConvexFields(zAgentPresence.shape))
  .index("by_meeting_and_member", ["meetingId", "memberId"])
  .index("by_session", ["sessionId"]);
