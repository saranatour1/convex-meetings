import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import {
  authedMutation,
  authedQuery,
  orgMutation,
  orgQuery,
  zPaginationOpts,
} from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { audit } from "../models/audit";
import { joinByDomain, joinableOrgs, setJoinDomain as saveJoinDomain } from "../models/domains";
import {
  MEMBER_ROLE,
  actorOf,
  createOrg,
  findRole,
  isOwner,
  listOrgsForUser,
  listRoles,
  renameOrg,
  requireGrantableRole,
} from "../models/orgs";
import { zDomain, zOrganization } from "../tables/organizations";

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
    if (!org) return null;
    return {
      _id: org._id,
      name: org.name,
      joinDomain: org.joinDomain ?? null,
      joinRoleId: org.joinRoleId ?? null,
      permissions: [...ctx.permissions],
      isOwner: await isOwner(ctx, orgId, ctx.member._id),
    };
  },
});

export const rename = orgMutation({
  args: { name: zOrganization.shape.name },
  handler: async (ctx, { orgId, name }) => {
    ctx.requirePermission("manageOrganization");
    await renameOrg(ctx, orgId, name);
    await audit(ctx, orgId, ctx.userId, "orgRenamed", { detail: name });
  },
});

export const setJoinDomain = orgMutation({
  args: { domain: zDomain.nullable(), roleId: zid("roles").optional() },
  handler: async (ctx, { orgId, domain, roleId }) => {
    ctx.requirePermission("manageOrganization");
    const fallback = await findRole(ctx, orgId, MEMBER_ROLE);
    const role = roleId ?? fallback?._id;
    if (!role) throw new ConvexError("This organization has no Member role");
    await requireGrantableRole(ctx, orgId, actorOf(ctx), role);
    await saveJoinDomain(ctx, orgId, ctx.userId, domain, role);
    await audit(ctx, orgId, ctx.userId, "joinDomainChanged", { detail: domain ?? "off" });
  },
});

export const joinable = authedQuery({
  args: {},
  handler: (ctx) => joinableOrgs(ctx, ctx.userId),
});

export const joinWithDomain = authedMutation({
  args: { orgId: zid("organizations") },
  handler: async (ctx, { orgId }) => {
    await enforceRateLimit(ctx, "accept", ctx.userId);
    if (await joinByDomain(ctx, ctx.userId, orgId)) {
      await audit(ctx, orgId, ctx.userId, "memberJoined", { detail: "Email domain" });
    }
  },
});
