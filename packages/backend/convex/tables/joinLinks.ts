import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zJoinLink = z.object({
  orgId: zid("organizations"),
  roleId: zid("roles"),
  createdBy: zid("users"),
  tokenId: zid("tokens"),
  maxUses: z.number().int().min(1).max(1000).optional(),
  uses: z.number().int().min(0),
  revokedAt: z.number().optional(),
});

export const joinLinks = defineTable(zodToConvexFields(zJoinLink.shape))
  .index("by_org", ["orgId"])
  .index("by_token", ["tokenId"]);
