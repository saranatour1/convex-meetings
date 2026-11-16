import { authedMutation, authedQuery, orgQuery, zPaginationOpts } from "../lib/functions";
import { createOrg, listOrgsForUser, listRoles } from "../models/orgs";
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
    const org = await ctx.db.get("organizations", orgId);
    return org && { _id: org._id, name: org.name };
  },
});
