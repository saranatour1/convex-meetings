import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zRingStatus = z.enum(["ringing", "accepted", "declined", "missed", "cancelled"]);

export const zRing = z.object({
  orgId: zid("organizations"),
  meetingId: zid("meetings"),
  callerId: zid("users"),
  calleeId: zid("users"),
  status: zRingStatus,
});

export const rings = defineTable(zodToConvexFields(zRing.shape))
  .index("by_callee_and_status", ["calleeId", "status"])
  .index("by_meeting_and_caller", ["meetingId", "callerId"]);
