import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMember = z.object({
  orgId: zid("organizations"),
  userId: zid("users"),
});

export const members = defineTable(zodToConvexFields(zMember.shape))
  .index("by_org_and_user", ["orgId", "userId"])
  .index("by_user", ["userId"]);
