import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

const MAX_RANGES_PER_WEEK = 21;

const zTimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const zAvailableRange = z
  .object({
    weekday: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    start: zTimeOfDay,
    end: zTimeOfDay,
  })
  .refine(({ start, end }) => start < end, { message: "End must be after start" });

export const zSchedule = z.object({
  userId: zid("users"),
  timeZone: z.string(),
  weeklyHours: z.array(zAvailableRange).max(MAX_RANGES_PER_WEEK),
});

export const schedules = defineTable(zodToConvexFields(zSchedule.shape)).index("by_user", [
  "userId",
]);
