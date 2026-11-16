import { zid } from "convex-helpers/server/zod4";
import { orgMutation, orgQuery, zPaginationOpts } from "../lib/functions";
import { listMembers, removeMember } from "../models/members";
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
