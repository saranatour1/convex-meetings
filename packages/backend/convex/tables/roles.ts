import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

const zPermission = z.enum([
  "inviteMembers",
  "removeMembers",
  "manageRoles",
  "manageGroups",
  "createMeetings",
  "manageMeetings",
]);

export const zRole = z.object({
  orgId: zid("organizations"),
  name: z.string().trim().min(1).max(40),
  permissions: z.partialRecord(zPermission, z.boolean()),
});

export const roles = defineTable(zodToConvexFields(zRole.shape)).index("by_org_and_name", [
  "orgId",
  "name",
]);
