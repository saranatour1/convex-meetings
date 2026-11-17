import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zRoom = z.object({
  meetingId: zid("meetings"),
  orgId: zid("organizations"),
  description: z.string().trim().min(1).max(500),
  people: z.number().int().min(0),
  closedAt: z.number().optional(),
});

export const rooms = defineTable(zodToConvexFields(zRoom.shape))
  .index("by_meeting", ["meetingId"])
  .index("by_org", ["orgId"])
  .index("by_closed_and_people", ["closedAt", "people"]);
