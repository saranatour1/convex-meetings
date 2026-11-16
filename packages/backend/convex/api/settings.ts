import { authedMutation, authedQuery } from "../lib/functions";
import { getSettings, saveSettings } from "../models/settings";
import { zUserSettings } from "../tables/userSettings";

export const getMine = authedQuery({
  args: {},
  handler: (ctx) => getSettings(ctx, ctx.userId),
});

export const setMine = authedMutation({
  args: zUserSettings.omit({ userId: true }).partial().shape,
  handler: (ctx, changes) => saveSettings(ctx, ctx.userId, changes),
});
