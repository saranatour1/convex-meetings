import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { components } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_ROLES_PER_MEMBER } from "./roles";
import { getViewer } from "./users";

export const findMember = (ctx: QueryCtx, orgId: Id<"organizations">, userId: Id<"users">) =>
  ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();

export const addMember = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
  roleId: Id<"roles">,
) => {
  const existing = await findMember(ctx, orgId, userId);
  if (existing) return existing._id;
  const memberId = await ctx.db.insert("members", { orgId, userId });
  await ctx.db.insert("memberRoles", { orgId, memberId, roleId });
  return memberId;
};

const rolesOf = async (ctx: QueryCtx, memberId: Id<"members">) => {
  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_member_and_role", (q) => q.eq("memberId", memberId))
    .take(MAX_ROLES_PER_MEMBER);
  const roles = await Promise.all(assignments.map((a) => ctx.db.get("roles", a.roleId)));
  return roles.filter((role) => role !== null);
};

const scheduleOf = (ctx: QueryCtx, userId: Id<"users">) =>
  ctx.db
    .query("schedules")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

const lastActive = async (ctx: QueryCtx, userId: Id<"users">) => {
  const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId });
  return sessions.reduce<number | null>(
    (latest, session) => Math.max(latest ?? 0, session.lastRefreshedAt),
    null,
  );
};

const describeMember = async (ctx: QueryCtx, member: Doc<"members">) => {
  const [user, roles, schedule] = await Promise.all([
    getViewer(ctx, member.userId),
    rolesOf(ctx, member._id),
    scheduleOf(ctx, member.userId),
  ]);
  return {
    _id: member._id,
    userId: member.userId,
    name: user?.name ?? "Anonymous",
    email: user?.email ?? null,
    imageUrl: user?.imageUrl ?? null,
    isVerified: user?.isVerified ?? false,
    seenTimeZone: user?.seenTimeZone ?? null,
    roles: roles.map((role) => ({ _id: role._id, name: role.name })),
    schedule: schedule ? { timeZone: schedule.timeZone, weeklyHours: schedule.weeklyHours } : null,
  };
};

export const listMembers = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId))
    .paginate(paginationOpts);
  return {
    ...result,
    page: await Promise.all(result.page.map((m) => describeMember(ctx, m))),
  };
};

export const membersLastActive = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userIds: Id<"users">[],
) => {
  const entries = await Promise.all(
    userIds.map(async (userId) =>
      (await findMember(ctx, orgId, userId))
        ? ([userId, await lastActive(ctx, userId)] as const)
        : null,
    ),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
};

const isLastHolder = async (ctx: QueryCtx, roleId: Id<"roles">) => {
  const holders = await ctx.db
    .query("memberRoles")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .take(2);
  return holders.length < 2;
};

export const setMemberRole = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  memberId: Id<"members">,
  roleId: Id<"roles">,
  ownerRoleId: Id<"roles"> | null,
) => {
  const [member, role] = await Promise.all([
    ctx.db.get("members", memberId),
    ctx.db.get("roles", roleId),
  ]);
  if (!member || member.orgId !== orgId) throw new ConvexError("Not a member");
  if (!role || role.orgId !== orgId) throw new ConvexError("Unknown role");
  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_member_and_role", (q) => q.eq("memberId", memberId))
    .take(MAX_ROLES_PER_MEMBER);
  const losesOwner = roleId !== ownerRoleId && assignments.some((a) => a.roleId === ownerRoleId);
  if (ownerRoleId && losesOwner && (await isLastHolder(ctx, ownerRoleId))) {
    throw new ConvexError("An organization needs at least one owner");
  }
  await Promise.all(assignments.map((a) => ctx.db.delete("memberRoles", a._id)));
  await ctx.db.insert("memberRoles", { orgId, memberId, roleId });
  return member;
};

export const removeMember = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  memberId: Id<"members">,
  ownerRoleId: Id<"roles"> | null,
) => {
  const member = await ctx.db.get("members", memberId);
  if (!member || member.orgId !== orgId) throw new ConvexError("Not a member");
  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_member_and_role", (q) => q.eq("memberId", memberId))
    .take(MAX_ROLES_PER_MEMBER);
  const isOwner = assignments.some((a) => a.roleId === ownerRoleId);
  if (ownerRoleId && isOwner && (await isLastHolder(ctx, ownerRoleId))) {
    throw new ConvexError("An organization needs at least one owner");
  }
  await Promise.all(assignments.map((a) => ctx.db.delete("memberRoles", a._id)));
  await ctx.db.delete("members", memberId);
  return member;
};
