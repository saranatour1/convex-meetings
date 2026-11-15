import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { authedMutation } from "../lib/functions";
import * as Users from "../models/users";
import { vViewer } from "../tables/users";

export const viewer = query({
  args: {},
  returns: v.union(v.null(), vViewer),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId === null ? null : Users.getViewer(ctx, userId);
  },
});

export const updateBio = authedMutation({
  args: { bio: v.string() },
  returns: v.null(),
  handler: async (ctx, { bio }) => {
    await Users.setBio(ctx, ctx.userId, bio);
    return null;
  },
});
