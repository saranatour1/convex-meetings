import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "../_generated/server";
import { authedMutation, authedQuery } from "../lib/functions";
import { listSessions, signOutEverywhere as revokeAll } from "../models/sessions";
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

export const sessions = authedQuery({
  args: {},
  handler: async (ctx) => {
    const current = (await ctx.auth.getUserIdentity())?.subject;
    const sessions = await listSessions(ctx, ctx.userId);
    return sessions
      .map((session) => ({
        _id: session.sessionId,
        startedAt: session.creationTime,
        lastActiveAt: session.lastRefreshedAt,
        current: session.sessionId === current,
      }))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  },
});

export const signOutEverywhere = authedMutation({
  args: {},
  handler: (ctx) => revokeAll(ctx, ctx.userId),
});
