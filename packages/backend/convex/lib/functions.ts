import { NoOp, customCtx, customCtxAndArgs } from "convex-helpers/server/customFunctions";
import {
  type ZCustomCtx,
  convexToZod,
  zCustomAction,
  zCustomMutation,
  zCustomQuery,
} from "convex-helpers/server/zod4";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { action, mutation, query, type ActionCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { findGuestUserId, guestUserId } from "../models/guests";
import { requireSignedIn, requireVerifiedUserId } from "../models/passkeys";
import { grantedPermissions, type Permission } from "../models/roles";

const verifiedUserIdInAction = (ctx: ActionCtx): Promise<Id<"users">> =>
  ctx.runQuery(internal.internal.passkeys.verifiedUserId, {});

const requireMember = async (ctx: QueryCtx, orgId: Id<"organizations">, userId: Id<"users">) => {
  const member = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!member) throw new ConvexError("Not a member");
  return member;
};

const verifiedUser = customCtx(async (ctx: QueryCtx) => ({
  userId: await requireVerifiedUserId(ctx),
}));

const signedInSession = customCtx((ctx: QueryCtx) => requireSignedIn(ctx));

const orgMember = customCtxAndArgs({
  args: { orgId: v.id("organizations") },
  input: async (ctx: QueryCtx, { orgId }) => {
    const userId = await requireVerifiedUserId(ctx);
    const member = await requireMember(ctx, orgId, userId);
    const permissions = await grantedPermissions(ctx, member._id);
    const requirePermission = (permission: Permission) => {
      if (!permissions.has(permission)) throw new ConvexError("Not allowed");
    };
    const can = (permission: Permission) => permissions.has(permission);
    return { ctx: { userId, member, permissions, requirePermission, can }, args: { orgId } };
  },
});

const meetingCaller = customCtxAndArgs({
  args: { guest: v.optional(v.string()) },
  input: async (ctx: QueryCtx, { guest }) => ({
    ctx: { userId: guest ? await guestUserId(ctx, guest) : await requireVerifiedUserId(ctx) },
    args: {},
  }),
});

const meetingViewer = customCtxAndArgs({
  args: { guest: v.optional(v.string()) },
  input: async (ctx: QueryCtx, { guest }) => ({
    ctx: {
      userId: guest ? await findGuestUserId(ctx, guest) : await requireVerifiedUserId(ctx),
    },
    args: {},
  }),
});

const meetingCallerAction = customCtxAndArgs({
  args: { guest: v.optional(v.string()) },
  input: async (
    ctx: ActionCtx,
    { guest },
  ): Promise<{ ctx: { userId: Id<"users"> }; args: Record<string, never> }> => {
    const userId: Id<"users"> = guest
      ? await ctx.runQuery(internal.internal.guests.userId, { secret: guest })
      : await verifiedUserIdInAction(ctx);
    return { ctx: { userId }, args: {} };
  },
});

export const zPaginationOpts = convexToZod(paginationOptsValidator);

export const publicQuery = zCustomQuery(query, NoOp);
export const publicMutation = zCustomMutation(mutation, NoOp);
export const signedInQuery = zCustomQuery(query, signedInSession);
export const signedInMutation = zCustomMutation(mutation, signedInSession);
export const authedQuery = zCustomQuery(query, verifiedUser);
export const authedMutation = zCustomMutation(mutation, verifiedUser);
export const authedAction = zCustomAction(
  action,
  customCtx(async (ctx: ActionCtx) => ({ userId: await verifiedUserIdInAction(ctx) })),
);
export const meetingQuery = zCustomQuery(query, meetingViewer);
export const meetingMutation = zCustomMutation(mutation, meetingCaller);
export const meetingAction = zCustomAction(action, meetingCallerAction);
export const orgQuery = zCustomQuery(query, orgMember);
export const orgMutation = zCustomMutation(mutation, orgMember);

export type OrgQueryCtx = ZCustomCtx<typeof orgQuery>;
export type OrgMutationCtx = ZCustomCtx<typeof orgMutation>;
