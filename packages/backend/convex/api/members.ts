import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { orgMutation, orgQuery, zPaginationOpts } from "../lib/functions";
import { audit } from "../models/audit";
import { kickFromOrgCalls } from "../models/calls";
import { listMembers, membersLastActive, removeMember, setMemberRole } from "../models/members";
import {
  OWNER_ROLE,
  actorOf,
  assertOutranks,
  findRole,
  isOwner,
  requireGrantableRole,
} from "../models/orgs";
import { signOutEverywhere as revokeAll } from "../models/sessions";

export const list = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => listMembers(ctx, orgId, paginationOpts),
});

export const lastActive = orgQuery({
  args: { userIds: z.array(zid("users")).max(100) },
  handler: (ctx, { orgId, userIds }) => {
    ctx.requirePermission("manageOrganization");
    return membersLastActive(ctx, orgId, userIds);
  },
});

export const remove = orgMutation({
  args: { memberId: zid("members") },
  handler: async (ctx, { orgId, memberId }) => {
    if (memberId !== ctx.member._id) ctx.requirePermission("removeMembers");
    await assertOutranks(ctx, orgId, actorOf(ctx), memberId);
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    const member = await removeMember(ctx, orgId, memberId, owner?._id ?? null);
    if (memberId !== ctx.member._id) await kickFromOrgCalls(ctx, orgId, member.userId);
    if (memberId === ctx.member._id) await audit(ctx, orgId, ctx.userId, "memberLeft");
    else await audit(ctx, orgId, ctx.userId, "memberRemoved", { targetUserId: member.userId });
  },
});

export const leave = orgMutation({
  args: {},
  handler: async (ctx, { orgId }) => {
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    await removeMember(ctx, orgId, ctx.member._id, owner?._id ?? null);
    await audit(ctx, orgId, ctx.userId, "memberLeft");
  },
});

export const setRole = orgMutation({
  args: { memberId: zid("members"), roleId: zid("roles") },
  handler: async (ctx, { orgId, memberId, roleId }) => {
    ctx.requirePermission("manageRoles");
    const actor = actorOf(ctx);
    await assertOutranks(ctx, orgId, actor, memberId);
    const role = await requireGrantableRole(ctx, orgId, actor, roleId);
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    const member = await setMemberRole(ctx, orgId, memberId, roleId, owner?._id ?? null);
    await audit(ctx, orgId, ctx.userId, "memberRoleChanged", {
      targetUserId: member.userId,
      detail: role.name,
    });
  },
});

export const signOutEverywhere = orgMutation({
  args: { memberId: zid("members") },
  handler: async (ctx, { orgId, memberId }) => {
    if (!(await isOwner(ctx, orgId, ctx.member._id))) {
      throw new ConvexError("Only owners can sign people out");
    }
    const member = await ctx.db.get("members", memberId);
    if (!member || member.orgId !== orgId) throw new ConvexError("Not a member");
    const count = await revokeAll(ctx, member.userId);
    await audit(ctx, orgId, ctx.userId, "memberSignedOut", {
      targetUserId: member.userId,
      detail: `${count} sessions`,
    });
  },
});
