import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMemberRole = z.object({
  orgId: zid("organizations"),
  memberId: zid("members"),
  roleId: zid("roles"),
});

export const memberRoles = defineTable(zodToConvexFields(zMemberRole.shape))
  .index("by_member_and_role", ["memberId", "roleId"])
  .index("by_role", ["roleId"]);
