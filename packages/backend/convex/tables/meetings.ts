import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeeting = z.object({
  orgId: zid("organizations"),
  hostId: zid("users"),
  title: z.string().trim().min(1).max(200),
  startsAt: z.number(),
  durationMinutes: z.literal([15, 30, 45, 60]),
});

export const zAttendee = z.object({
  meetingId: zid("meetings"),
  userId: zid("users"),
  response: z.enum(["pending", "accepted", "declined"]),
  startsAt: z.number(),
});

export const meetings = defineTable(zodToConvexFields(zMeeting.shape)).index(
  "by_org_and_startsAt",
  ["orgId", "startsAt"],
);

export const attendees = defineTable(zodToConvexFields(zAttendee.shape))
  .index("by_meeting_and_user", ["meetingId", "userId"])
  .index("by_user_and_startsAt", ["userId", "startsAt"]);
