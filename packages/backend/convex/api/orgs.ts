import { authedMutation, authedQuery, orgQuery, zPaginationOpts } from "../lib/functions";
import { createOrg, listOrgsForUser, listRoles } from "../models/orgs";
import { grantedPermissions } from "../models/roles";
import { zOrganization } from "../tables/organizations";

export const create = authedMutation({
  args: { name: zOrganization.shape.name },
  handler: (ctx, { name }) => createOrg(ctx, ctx.userId, name),
});

export const listMine = authedQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { paginationOpts }) => listOrgsForUser(ctx, ctx.userId, paginationOpts),
});

export const roles = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => listRoles(ctx, orgId, paginationOpts),
});

export const get = orgQuery({
  args: {},
  handler: async (ctx, { orgId }) => {
    const [org, permissions] = await Promise.all([
      ctx.db.get("organizations", orgId),
      grantedPermissions(ctx, ctx.member._id),
    ]);
    return org && { _id: org._id, name: org.name, permissions: [...permissions] };
  },
});
