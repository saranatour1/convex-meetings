import { defineTable } from "convex/server";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zOrganization = z.object({
  name: z.string().trim().min(1).max(80),
});

export const organizations = defineTable(zodToConvexFields(zOrganization.shape));
