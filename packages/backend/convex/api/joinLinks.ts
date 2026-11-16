import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import {
  authedMutation,
  orgMutation,
  orgQuery,
  publicQuery,
  zPaginationOpts,
} from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { audit } from "../models/audit";
import {
  acceptJoinLink,
  createJoinLink,
  listJoinLinks,
  previewJoinLink,
  revokeJoinLink,
} from "../models/joinLinks";
import { activateOrg, actorOf, requireGrantableRole } from "../models/orgs";

const zSecret = z.string().regex(/^[0-9a-f]{64}$/);

export const create = orgMutation({
  args: {
    roleId: zid("roles"),
    days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
    maxUses: z.number().int().min(1).max(1000).optional(),
  },
  handler: async (ctx, { orgId, roleId, days, maxUses }) => {
    ctx.requirePermission("inviteMembers");
    const role = await requireGrantableRole(ctx, orgId, actorOf(ctx), roleId);
    await enforceRateLimit(ctx, "joinLink", orgId);
    const secret = await createJoinLink(ctx, {
      orgId,
      roleId,
      createdBy: ctx.userId,
      days,
      maxUses,
    });
    await audit(ctx, orgId, ctx.userId, "joinLinkCreated", { detail: role.name });
    return secret;
  },
});

export const list = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => {
    ctx.requirePermission("inviteMembers");
    return listJoinLinks(ctx, orgId, paginationOpts);
  },
});

export const revoke = orgMutation({
  args: { linkId: zid("joinLinks") },
  handler: async (ctx, { orgId, linkId }) => {
    ctx.requirePermission("inviteMembers");
    await revokeJoinLink(ctx, orgId, linkId);
    await audit(ctx, orgId, ctx.userId, "joinLinkRevoked");
  },
});

export const preview = publicQuery({
  args: { secret: z.string() },
  handler: (ctx, { secret }) =>
    zSecret.safeParse(secret).success ? previewJoinLink(ctx, secret) : null,
});

export const accept = authedMutation({
  args: { secret: zSecret },
  handler: async (ctx, { secret }) => {
    await enforceRateLimit(ctx, "accept", ctx.userId);
    const { orgId, joined } = await acceptJoinLink(ctx, ctx.userId, secret);
    await activateOrg(ctx, ctx.userId, orgId);
    if (joined) await audit(ctx, orgId, ctx.userId, "memberJoined", { detail: "Invite link" });
    return orgId;
  },
});
