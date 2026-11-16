import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zUserSettings } from "../tables/userSettings";

export type Settings = Omit<typeof zUserSettings._output, "userId">;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  joinMuted: false,
  joinCameraOff: false,
  defaultKind: "groupCall",
  defaultMinutes: 30,
  defaultRecap: true,
  autoRecord: false,
  invitesFrom: "everyone",
};

const findSettings = (ctx: QueryCtx, userId: Id<"users">) =>
  ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

export const getSettings = async (ctx: QueryCtx, userId: Id<"users">): Promise<Settings> => {
  const row = await findSettings(ctx, userId);
  if (!row) return DEFAULT_SETTINGS;
  const { _id, _creationTime, userId: _owner, ...settings } = row;
  return settings;
};

export const saveSettings = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  changes: Partial<Settings>,
) => {
  const next = parseOrThrow(zUserSettings, {
    ...(await getSettings(ctx, userId)),
    ...changes,
    userId,
  });
  const existing = await findSettings(ctx, userId);
  if (existing) await ctx.db.replace("userSettings", existing._id, next);
  else await ctx.db.insert("userSettings", next);
};
