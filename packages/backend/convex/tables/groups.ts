import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zGroup = z.object({
  orgId: zid("organizations"),
  name: z.string().trim().min(1).max(80),
});

export const groups = defineTable(zodToConvexFields(zGroup.shape)).index("by_org", ["orgId"]);
