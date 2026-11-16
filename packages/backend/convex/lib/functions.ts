import { getAuthUserId } from "@convex-dev/auth/server";
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
import { grantedPermissions, type Permission } from "../models/roles";

const requireUserId = async (ctx: Pick<QueryCtx, "auth" | "runQuery">) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Unauthenticated");
  return userId;
};

const requireMember = async (ctx: QueryCtx, orgId: Id<"organizations">, userId: Id<"users">) => {
  const member = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!member) throw new ConvexError("Not a member");
  return member;
};

const signedInUser = customCtx(async (ctx: QueryCtx) => ({ userId: await requireUserId(ctx) }));

const orgMember = customCtxAndArgs({
  args: { orgId: v.id("organizations") },
  input: async (ctx: QueryCtx, { orgId }) => {
    const userId = await requireUserId(ctx);
    const member = await requireMember(ctx, orgId, userId);
    const permissions = await grantedPermissions(ctx, member._id);
    const requirePermission = (permission: Permission) => {
      if (!permissions.has(permission)) throw new ConvexError("Not allowed");
    };
    return { ctx: { userId, member, requirePermission }, args: { orgId } };
  },
});

export const zPaginationOpts = convexToZod(paginationOptsValidator);

export const publicQuery = zCustomQuery(query, NoOp);
export const authedQuery = zCustomQuery(query, signedInUser);
export const authedMutation = zCustomMutation(mutation, signedInUser);
export const authedAction = zCustomAction(
  action,
  customCtx(async (ctx: ActionCtx) => ({
    userId: await requireUserId(ctx as unknown as Pick<QueryCtx, "auth" | "runQuery">),
  })),
);
export const orgQuery = zCustomQuery(query, orgMember);
export const orgMutation = zCustomMutation(mutation, orgMember);

export type OrgQueryCtx = ZCustomCtx<typeof orgQuery>;
export type OrgMutationCtx = ZCustomCtx<typeof orgMutation>;
