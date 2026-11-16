import { authedMutation, authedQuery } from "../lib/functions";
import { getSchedule, saveSchedule } from "../models/schedules";
import { zSchedule } from "../tables/schedules";

export const getMine = authedQuery({
  args: {},
  handler: (ctx) => getSchedule(ctx, ctx.userId),
});

export const setMine = authedMutation({
  args: {
    timeZone: zSchedule.shape.timeZone,
    weeklyHours: zSchedule.shape.weeklyHours,
    alsoShow: zSchedule.shape.alsoShow,
  },
  handler: (ctx, schedule) => saveSchedule(ctx, ctx.userId, schedule),
});
