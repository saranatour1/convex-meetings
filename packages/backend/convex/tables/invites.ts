import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zInvite = z.object({
  orgId: zid("organizations"),
  roleId: zid("roles"),
  invitedBy: zid("users"),
  tokenId: zid("tokens"),
});

export const invites = defineTable(zodToConvexFields(zInvite.shape))
  .index("by_org", ["orgId"])
  .index("by_token", ["tokenId"]);
