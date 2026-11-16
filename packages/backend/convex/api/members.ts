import { zid } from "convex-helpers/server/zod4";
import { orgMutation, orgQuery, zPaginationOpts } from "../lib/functions";
import { listMembers, removeMember, setMemberRole } from "../models/members";
import { OWNER_ROLE, findRole } from "../models/orgs";

export const list = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => listMembers(ctx, orgId, paginationOpts),
});

export const remove = orgMutation({
  args: { memberId: zid("members") },
  handler: async (ctx, { orgId, memberId }) => {
    if (memberId !== ctx.member._id) ctx.requirePermission("removeMembers");
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    await removeMember(ctx, orgId, memberId, owner?._id ?? null);
  },
});

export const leave = orgMutation({
  args: {},
  handler: async (ctx, { orgId }) => {
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    await removeMember(ctx, orgId, ctx.member._id, owner?._id ?? null);
  },
});

export const setRole = orgMutation({
  args: { memberId: zid("members"), roleId: zid("roles") },
  handler: async (ctx, { orgId, memberId, roleId }) => {
    ctx.requirePermission("manageRoles");
    const owner = await findRole(ctx, orgId, OWNER_ROLE);
    await setMemberRole(ctx, orgId, memberId, roleId, owner?._id ?? null);
  },
});
