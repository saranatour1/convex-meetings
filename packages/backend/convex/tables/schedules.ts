import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";
import { zIsoWeekday, zTimeOfDay, zTimeZone } from "../lib/time";

const zAvailableRange = z
  .object({
    weekday: zIsoWeekday,
    start: zTimeOfDay,
    end: zTimeOfDay,
  })
  .refine(({ start, end }) => start < end, { message: "End must be after start" });

export const zSchedule = z.object({
  userId: zid("users"),
  timeZone: zTimeZone,
  weeklyHours: z.array(zAvailableRange),
});

export const schedules = defineTable(zodToConvexFields(zSchedule.shape)).index("by_user", [
  "userId",
]);
