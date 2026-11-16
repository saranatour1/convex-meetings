import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zOrganization } from "../tables/organizations";
import { zRole } from "../tables/roles";
import { addMember } from "./members";
import { grantedPermissions, type Permission } from "./roles";

export const OWNER_ROLE = "Owner";
export const ADMIN_ROLE = "Admin";
export const MEMBER_ROLE = "Member";

export const ALL_PERMISSIONS = {
  inviteMembers: true,
  removeMembers: true,
  manageRoles: true,
  manageGroups: true,
  createMeetings: true,
  manageMeetings: true,
  manageOrganization: true,
};

const insertRole = (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  name: string,
  permissions: Partial<typeof ALL_PERMISSIONS>,
) => ctx.db.insert("roles", parseOrThrow(zRole, { orgId, name, permissions }));

export const createOrg = async (ctx: MutationCtx, userId: Id<"users">, name: string) => {
  const orgId = await ctx.db.insert("organizations", parseOrThrow(zOrganization, { name }));
  const ownerRoleId = await insertRole(ctx, orgId, OWNER_ROLE, ALL_PERMISSIONS);
  await insertRole(ctx, orgId, ADMIN_ROLE, ALL_PERMISSIONS);
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

export const renameOrg = async (ctx: MutationCtx, orgId: Id<"organizations">, name: string) => {
  await ctx.db.patch("organizations", orgId, parseOrThrow(zOrganization, { name }));
};

type RolePermissions = Partial<typeof ALL_PERMISSIONS>;

const BUILT_IN_ROLES = [OWNER_ROLE, ADMIN_ROLE, MEMBER_ROLE];
const LOCKED_ROLES = [OWNER_ROLE, ADMIN_ROLE];

const requireRole = async (ctx: QueryCtx, orgId: Id<"organizations">, roleId: Id<"roles">) => {
  const role = await ctx.db.get("roles", roleId);
  if (!role || role.orgId !== orgId) throw new ConvexError("Unknown role");
  return role;
};

export type Actor = { memberId: Id<"members">; permissions: Set<Permission> };

const holdsRole = async (ctx: QueryCtx, memberId: Id<"members">, roleId: Id<"roles">) =>
  (await ctx.db
    .query("memberRoles")
    .withIndex("by_member_and_role", (q) => q.eq("memberId", memberId).eq("roleId", roleId))
    .unique()) !== null;

export const isOwner = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  memberId: Id<"members">,
) => {
  const owner = await findRole(ctx, orgId, OWNER_ROLE);
  return owner !== null && (await holdsRole(ctx, memberId, owner._id));
};

const requireOwner = async (ctx: QueryCtx, orgId: Id<"organizations">, actor: Actor) => {
  if (!(await isOwner(ctx, orgId, actor.memberId))) {
    throw new ConvexError("Only owners can do that");
  }
};

export const assertCanGrant = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  role: Pick<Doc<"roles">, "name" | "permissions">,
) => {
  const beyond = Object.entries(role.permissions).some(
    ([permission, granted]) => granted && !actor.permissions.has(permission as Permission),
  );
  if (beyond) throw new ConvexError("You can't grant permissions you don't have");
  if (role.name === OWNER_ROLE) await requireOwner(ctx, orgId, actor);
};

export const assertOutranks = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  memberId: Id<"members">,
) => {
  if (memberId === actor.memberId) return;
  const theirs = await grantedPermissions(ctx, memberId);
  if ([...theirs].some((permission) => !actor.permissions.has(permission))) {
    throw new ConvexError("They have permissions you don't");
  }
  if (await isOwner(ctx, orgId, memberId)) await requireOwner(ctx, orgId, actor);
};

export const requireGrantableRole = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  roleId: Id<"roles">,
) => {
  const role = await requireRole(ctx, orgId, roleId);
  await assertCanGrant(ctx, orgId, actor, role);
  return role;
};

const requireFreeName = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  name: string,
  roleId?: Id<"roles">,
) => {
  const existing = await findRole(ctx, orgId, name.trim());
  if (existing && existing._id !== roleId)
    throw new ConvexError(`There's already a ${name.trim()} role`);
};

export const createRole = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  name: string,
  permissions: RolePermissions,
) => {
  await assertCanGrant(ctx, orgId, actor, { name, permissions });
  await requireFreeName(ctx, orgId, name);
  return insertRole(ctx, orgId, name, permissions);
};

export const updateRole = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  roleId: Id<"roles">,
  changes: { name?: string; permissions?: RolePermissions },
) => {
  const role = await requireRole(ctx, orgId, roleId);
  if (LOCKED_ROLES.includes(role.name)) {
    throw new ConvexError(`The ${role.name} role always has every permission`);
  }
  await assertCanGrant(ctx, orgId, actor, role);
  if (changes.permissions) {
    await assertCanGrant(ctx, orgId, actor, { name: role.name, permissions: changes.permissions });
  }
  if (changes.name !== undefined && BUILT_IN_ROLES.includes(role.name)) {
    throw new ConvexError(`The ${role.name} role can't be renamed`);
  }
  if (changes.name !== undefined) await requireFreeName(ctx, orgId, changes.name, roleId);
  await ctx.db.replace(
    "roles",
    roleId,
    parseOrThrow(zRole, {
      orgId,
      name: changes.name ?? role.name,
      permissions: changes.permissions ?? role.permissions,
    }),
  );
};

export const deleteRole = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actor: Actor,
  roleId: Id<"roles">,
) => {
  const role = await requireRole(ctx, orgId, roleId);
  await assertCanGrant(ctx, orgId, actor, role);
  if (BUILT_IN_ROLES.includes(role.name))
    throw new ConvexError(`The ${role.name} role can't be deleted`);
  const fallback = await findRole(ctx, orgId, MEMBER_ROLE);
  const holders = await ctx.db
    .query("memberRoles")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .take(1000);
  for (const holder of holders) {
    await ctx.db.delete("memberRoles", holder._id);
    const others = await ctx.db
      .query("memberRoles")
      .withIndex("by_member_and_role", (q) => q.eq("memberId", holder.memberId))
      .first();
    if (!others && fallback) {
      await ctx.db.insert("memberRoles", {
        orgId,
        memberId: holder.memberId,
        roleId: fallback._id,
      });
    }
  }
  await ctx.db.delete("roles", roleId);
  return role;
};

export const actorOf = (ctx: { member: { _id: Id<"members"> }; permissions: Set<Permission> }) => ({
  memberId: ctx.member._id,
  permissions: ctx.permissions,
});
