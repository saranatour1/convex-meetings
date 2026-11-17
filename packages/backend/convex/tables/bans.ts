import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zDeviceId = z.string().min(8).max(64);

export const zBan = z.object({
  orgId: zid("organizations"),
  userId: zid("users"),
  deviceId: zDeviceId.optional(),
  reason: z.string().max(40),
  flagId: zid("moderationFlags").optional(),
  bannedBy: zid("users").optional(),
  expiresAt: z.number().optional(),
  liftedAt: z.number().optional(),
  liftedBy: zid("users").optional(),
});

export const bans = defineTable(zodToConvexFields(zBan.shape))
  .index("by_org", ["orgId"])
  .index("by_org_and_user", ["orgId", "userId"])
  .index("by_org_and_device", ["orgId", "deviceId"]);
