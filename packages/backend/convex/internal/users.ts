import { vGithubProfile } from "@convex-dev/auth/methods/github/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { insertUser, insertUsernameUser, replaceImage as replaceUserImage } from "../models/users";

const vUsernameProfile = v.object({});

export const createPasskeyUser = internalMutation({
  args: { method: v.object({ name: v.literal("usernamePasskey"), profile: vUsernameProfile }) },
  returns: v.id("users"),
  handler: (ctx) => insertUsernameUser(ctx, "usernamePasskey"),
});

export const createPasswordUser = internalMutation({
  args: { method: v.object({ name: v.literal("usernamePassword"), profile: vUsernameProfile }) },
  returns: v.id("users"),
  handler: (ctx) => insertUsernameUser(ctx, "usernamePassword"),
});

export const createGoogleUser = internalMutation({
  args: { method: v.object({ name: v.literal("google"), profile: vGoogleProfile }) },
  returns: v.id("users"),
  handler: (ctx, { method: { profile } }) =>
    insertUser(
      ctx,
      {
        method: "google",
        name: profile.name,
        email: profile.email,
        isVerified: profile.emailVerified,
      },
      profile.picture,
    ),
});

export const createGithubUser = internalMutation({
  args: { method: v.object({ name: v.literal("github"), profile: vGithubProfile }) },
  returns: v.id("users"),
  handler: (ctx, { method: { profile } }) =>
    insertUser(
      ctx,
      {
        method: "github",
        name: profile.name ?? profile.login,
        email: profile.email,
        isVerified: profile.emailVerified,
      },
      profile.avatarUrl,
    ),
});

export const storeAvatar = internalAction({
  args: { userId: v.id("users"), url: v.string() },
  handler: async (ctx, { userId, url }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Avatar fetch failed: ${response.status}`);
    const imageId = await ctx.storage.store(await response.blob());
    await ctx.runMutation(internal.internal.users.replaceImage, { userId, imageId });
  },
});

export const replaceImage = internalMutation({
  args: { userId: v.id("users"), imageId: v.id("_storage") },
  handler: (ctx, { userId, imageId }) => replaceUserImage(ctx, userId, imageId),
});
