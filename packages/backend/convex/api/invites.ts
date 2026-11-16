import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import {
  authedMutation,
  orgMutation,
  orgQuery,
  publicQuery,
  zPaginationOpts,
} from "../lib/functions";
import {
  acceptInvite,
  createInvite,
  listInvites,
  previewInvite,
  resendInvite,
  revokeInvite,
} from "../models/invites";

const zSecret = z.string().regex(/^[0-9a-f]{64}$/);

export const create = orgMutation({
  args: { email: z.string(), roleId: zid("roles") },
  handler: (ctx, { orgId, email, roleId }) => {
    ctx.requirePermission("inviteMembers");
    return createInvite(ctx, { orgId, roleId, email, invitedBy: ctx.userId });
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
  handler: (ctx, { orgId, inviteId }) => {
    ctx.requirePermission("inviteMembers");
    return revokeInvite(ctx, orgId, inviteId);
  },
});

export const preview = publicQuery({
  args: { secret: z.string() },
  handler: (ctx, { secret }) =>
    zSecret.safeParse(secret).success ? previewInvite(ctx, secret) : null,
});

export const accept = authedMutation({
  args: { secret: zSecret },
  handler: (ctx, { secret }) => acceptInvite(ctx, ctx.userId, secret),
});
