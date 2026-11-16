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
import { actorOf, requireGrantableRole } from "../models/orgs";
import {
  acceptInvite,
  inviteMany,
  listInvites,
  previewInvite,
  resendInvite,
  revokeInvite,
} from "../models/invites";

const zSecret = z.string().regex(/^[0-9a-f]{64}$/);

export const create = orgMutation({
  args: {
    emails: z.array(z.string().trim().toLowerCase().pipe(z.email())).min(1).max(50),
    roleId: zid("roles"),
  },
  handler: async (ctx, { orgId, emails, roleId }) => {
    ctx.requirePermission("inviteMembers");
    await requireGrantableRole(ctx, orgId, actorOf(ctx), roleId);
    await enforceRateLimit(ctx, "invite", orgId, emails.length);
    const result = await inviteMany(ctx, { orgId, roleId, emails, invitedBy: ctx.userId });
    if (result.sent.length) {
      await audit(ctx, orgId, ctx.userId, "inviteSent", { detail: result.sent.join(", ") });
    }
    return result;
  },
});

export const list = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => {
    ctx.requirePermission("inviteMembers");
    return listInvites(ctx, orgId, paginationOpts);
  },
});

export const resend = orgMutation({
  args: { inviteId: zid("invites") },
  handler: (ctx, { orgId, inviteId }) => {
    ctx.requirePermission("inviteMembers");
    return resendInvite(ctx, orgId, inviteId);
  },
});

export const revoke = orgMutation({
  args: { inviteId: zid("invites") },
  handler: async (ctx, { orgId, inviteId }) => {
    ctx.requirePermission("inviteMembers");
    const invite = await revokeInvite(ctx, orgId, inviteId);
    await audit(ctx, orgId, ctx.userId, "inviteRevoked", { detail: invite.email });
  },
});

export const preview = publicQuery({
  args: { secret: z.string() },
  handler: (ctx, { secret }) =>
    zSecret.safeParse(secret).success ? previewInvite(ctx, secret) : null,
});

export const accept = authedMutation({
  args: { secret: zSecret },
  handler: async (ctx, { secret }) => {
    await enforceRateLimit(ctx, "accept", ctx.userId);
    const orgId = await acceptInvite(ctx, ctx.userId, secret);
    await audit(ctx, orgId, ctx.userId, "memberJoined", { detail: "Email invite" });
    return orgId;
  },
});
