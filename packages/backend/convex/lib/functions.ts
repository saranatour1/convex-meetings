import { getAuthUserId } from "@convex-dev/auth/server";
import { customCtx, customCtxAndArgs } from "convex-helpers/server/customFunctions";
import { zCustomMutation, zCustomQuery } from "convex-helpers/server/zod4";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import * as Members from "../models/members";

async function signedInUserId(ctx: Pick<QueryCtx, "auth" | "runQuery">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Unauthenticated");
  return userId;
}

const signedInUser = customCtx(async (ctx: QueryCtx) => ({ userId: await signedInUserId(ctx) }));

const orgMember = customCtxAndArgs({
  args: { orgId: v.id("organizations") },
  input: async (ctx: QueryCtx, { orgId }) => {
    const member = await Members.requireMember(ctx, orgId, await signedInUserId(ctx));
    return { ctx: { member }, args: {} };
  },
});

export const authedQuery = zCustomQuery(query, signedInUser);
export const authedMutation = zCustomMutation(mutation, signedInUser);
export const orgQuery = zCustomQuery(query, orgMember);
export const orgMutation = zCustomMutation(mutation, orgMember);
