import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zGroupMember = z.object({
  orgId: zid("organizations"),
  groupId: zid("groups"),
  userId: zid("users"),
});

export const groupMembers = defineTable(zodToConvexFields(zGroupMember.shape))
  .index("by_group_and_user", ["groupId", "userId"])
  .index("by_org_and_user", ["orgId", "userId"]);
