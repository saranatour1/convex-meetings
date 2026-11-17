import { vGithubProfile } from "@convex-dev/auth/methods/github/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { devEmailSignInOn } from "../models/passkeys";
import {
  copyUsernameToEmail,
  insertUser,
  isStorableAvatar,
  replaceImage as replaceUserImage,
} from "../models/users";

const vDevMethod = v.object({ name: v.literal("usernamePassword"), profile: v.object({}) });

const requireDevEmailSignIn = () => {
  if (!devEmailSignInOn()) throw new ConvexError("Email sign-in is only for development");
};

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

export const createDevUser = internalMutation({
  args: { method: vDevMethod },
  returns: v.id("users"),
  handler: async (ctx) => {
    requireDevEmailSignIn();
    const userId = await insertUser(ctx, { method: "devEmail", isVerified: false });
    await ctx.scheduler.runAfter(0, internal.internal.users.copyDevEmail, { userId });
    return userId;
  },
});

export const checkDevSignIn = internalMutation({
  args: { method: vDevMethod, userId: v.id("users") },
  returns: v.null(),
  handler: () => {
    requireDevEmailSignIn();
    return null;
  },
});

export const copyDevEmail = internalMutation({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => copyUsernameToEmail(ctx, userId),
});

export const storeAvatar = internalAction({
  args: { userId: v.id("users"), url: v.string() },
  handler: async (ctx, { userId, url }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Avatar fetch failed: ${response.status}`);
    const avatar = await response.blob();
    if (!isStorableAvatar(avatar)) return;
    const imageId = await ctx.storage.store(avatar);
    await ctx.runMutation(internal.internal.users.replaceImage, { userId, imageId });
  },
});

export const replaceImage = internalMutation({
  args: { userId: v.id("users"), imageId: v.id("_storage") },
  handler: (ctx, { userId, imageId }) => replaceUserImage(ctx, userId, imageId),
});
