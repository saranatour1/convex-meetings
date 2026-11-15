import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "../_generated/server";
import { authedMutation } from "../lib/functions";
import { getViewer, setBio } from "../models/users";
import { zUser } from "../tables/users";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId === null ? null : getViewer(ctx, userId);
  },
});

export const updateBio = authedMutation({
  args: { bio: zUser.shape.bio.unwrap() },
  handler: async (ctx, { bio }) => {
    await setBio(ctx, ctx.userId, bio);
  },
});
