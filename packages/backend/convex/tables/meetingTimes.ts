import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";
import { zTimeOfDay, zTimeZone } from "../lib/time";

export const zMeetingTime = z
  .object({
    meetingId: zid("meetings"),
    orgId: zid("organizations").optional(),
    date: z.number().int(),
    start: zTimeOfDay,
    end: zTimeOfDay,
    timeZone: zTimeZone,
    startsAt: z.number(),
    endsAt: z.number(),
    rrule: z.string().max(500).optional(),
    repeatUntil: z.number().optional(),
  })
  .refine(({ start, end }) => start < end, { message: "End must be after start" });

export const meetingTimes = defineTable(zodToConvexFields(zMeetingTime.shape))
  .index("by_meeting", ["meetingId"])
  .index("by_date", ["date"])
  .index("by_org_and_repeat_until", ["orgId", "repeatUntil"]);
