import type { PaginationOptions } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zOrganization } from "../tables/organizations";
import { zRole } from "../tables/roles";
import { addMember } from "./members";

export const OWNER_ROLE = "Owner";
export const MEMBER_ROLE = "Member";

const OWNER_PERMISSIONS = {
  inviteMembers: true,
  removeMembers: true,
  manageRoles: true,
  manageGroups: true,
  createMeetings: true,
  manageMeetings: true,
};

const insertRole = (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  name: string,
  permissions: Partial<typeof OWNER_PERMISSIONS>,
) => ctx.db.insert("roles", parseOrThrow(zRole, { orgId, name, permissions }));

export const createOrg = async (ctx: MutationCtx, userId: Id<"users">, name: string) => {
  const orgId = await ctx.db.insert("organizations", parseOrThrow(zOrganization, { name }));
  const ownerRoleId = await insertRole(ctx, orgId, OWNER_ROLE, OWNER_PERMISSIONS);
  await insertRole(ctx, orgId, MEMBER_ROLE, { createMeetings: true });
  await addMember(ctx, orgId, userId, ownerRoleId);
  return orgId;
};

export const listOrgsForUser = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  paginationOpts: PaginationOptions,
) => {
  const memberships = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .paginate(paginationOpts);
  const orgs = await Promise.all(memberships.page.map((m) => ctx.db.get("organizations", m.orgId)));
  return {
    ...memberships,
    page: orgs.filter((org) => org !== null).map((org) => ({ _id: org._id, name: org.name })),
  };
};

export const listRoles = (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) =>
  ctx.db
    .query("roles")
    .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId))
    .paginate(paginationOpts);

export const findRole = async (ctx: QueryCtx, orgId: Id<"organizations">, name: string) =>
  ctx.db
    .query("roles")
    .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("name", name))
    .unique();
