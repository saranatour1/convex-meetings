import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "../_generated/server";
import { authedMutation } from "../lib/functions";
import { zid } from "convex-helpers/server/zod4";
import { getViewer, setAvatar, setBio, setName, setSeenTimeZone } from "../models/users";
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

export const reportTimeZone = authedMutation({
  args: { timeZone: zUser.shape.seenTimeZone.unwrap() },
  handler: (ctx, { timeZone }) => setSeenTimeZone(ctx, ctx.userId, timeZone),
});

export const updateName = authedMutation({
  args: { name: zUser.shape.name.unwrap() },
  handler: (ctx, { name }) => setName(ctx, ctx.userId, name),
});

export const generateAvatarUploadUrl = authedMutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});

export const updateAvatar = authedMutation({
  args: { imageId: zid("_storage") },
  handler: (ctx, { imageId }) => setAvatar(ctx, ctx.userId, imageId),
});
