import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";
import { zMeetingKind } from "./meetings";

export const zUserSettings = z.object({
  userId: zid("users"),
  theme: z.enum(["light", "dark", "system"]),
  joinMuted: z.boolean(),
  joinCameraOff: z.boolean(),
  defaultKind: zMeetingKind,
  defaultMinutes: z.number().int().min(5).max(720),
  defaultRecap: z.boolean(),
  autoRecord: z.boolean(),
  invitesFrom: z.enum(["everyone", "managers"]),
});

export const userSettings = defineTable(zodToConvexFields(zUserSettings.shape)).index("by_user", [
  "userId",
]);
