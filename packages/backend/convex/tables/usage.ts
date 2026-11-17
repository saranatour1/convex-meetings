import { defineTable } from "convex/server";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zUsage = z.object({
  key: z.string().max(100),
  amount: z.number(),
});

export const usage = defineTable(zodToConvexFields(zUsage.shape)).index("by_key", ["key"]);
