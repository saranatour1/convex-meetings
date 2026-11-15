import { getAuthUserId } from "@convex-dev/auth/server";
import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import { mutation, type QueryCtx } from "../_generated/server";

async function signedInUserId(ctx: Pick<QueryCtx, "auth" | "runQuery">) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Unauthenticated");
  return userId;
}

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ userId: await signedInUserId(ctx) })),
);
