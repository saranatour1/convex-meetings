import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "../_generated/server";
import { authedMutation } from "../lib/functions";
import * as Users from "../models/users";
import { zBio } from "../tables/users";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId === null ? null : Users.getViewer(ctx, userId);
  },
});

export const updateBio = authedMutation({
  args: { bio: zBio },
  handler: async (ctx, { bio }) => {
    await Users.setBio(ctx, ctx.userId, bio);
  },
});
