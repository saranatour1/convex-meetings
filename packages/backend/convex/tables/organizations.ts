import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

const zMemberRole = z.enum(["owner", "admin", "member"]);
export const zOrganization = z.object({
  name: z.string().trim().min(1).max(80),
});

export const zMember = z.object({
  orgId: zid("organizations"),
  userId: zid("users"),
  role: zMemberRole,
});

export const zInvite = z.object({
  orgId: zid("organizations"),
  token: z.string(),
  role: zMemberRole.exclude(["owner"]),
  invitedBy: zid("users"),
  expiresAt: z.number(),
});

export const organizations = defineTable(zodToConvexFields(zOrganization.shape));

export const members = defineTable(zodToConvexFields(zMember.shape))
  .index("by_org_and_user", ["orgId", "userId"])
  .index("by_user", ["userId"]);

export const invites = defineTable(zodToConvexFields(zInvite.shape))
  .index("by_token", ["token"])
  .index("by_org", ["orgId"]);
