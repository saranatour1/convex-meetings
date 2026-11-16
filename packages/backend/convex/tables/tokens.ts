import { defineTable } from "convex/server";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zToken = z.object({
  value: z.string().min(32),
  expiresAt: z.number(),
});

export const tokens = defineTable(zodToConvexFields(zToken.shape))
  .index("by_value", ["value"])
  .index("by_expiresAt", ["expiresAt"]);
