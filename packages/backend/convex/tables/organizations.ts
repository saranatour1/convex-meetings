import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zDomain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "Use a domain like acme.com");

export const zOrganization = z.object({
  name: z.string().trim().min(1).max(80),
  joinDomain: zDomain.optional(),
  joinRoleId: zid("roles").optional(),
});

export const organizations = defineTable(zodToConvexFields(zOrganization.shape)).index(
  "by_join_domain",
  ["joinDomain"],
);
