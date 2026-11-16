import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zSchedule } from "../tables/schedules";

type ScheduleInput = Omit<typeof zSchedule._input, "userId">;

export const getSchedule = (ctx: QueryCtx, userId: Id<"users">) =>
  ctx.db
    .query("schedules")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

export const saveSchedule = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  schedule: ScheduleInput,
) => {
  const parsed = parseOrThrow(zSchedule, { ...schedule, userId });
  const existing = await getSchedule(ctx, userId);
  if (existing) {
    await ctx.db.replace("schedules", existing._id, parsed);
    return existing._id;
  }
  return ctx.db.insert("schedules", parsed);
};
