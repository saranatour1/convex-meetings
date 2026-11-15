import type { WithoutSystemFields } from "convex/server";
import type { z } from "zod";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { avatarWorkpool } from "../lib/workpools";
import type { zUsernameAuthMethod } from "../tables/users";

type NewUser = WithoutSystemFields<Doc<"users">>;

export async function insertUser(ctx: MutationCtx, user: NewUser, avatarUrl?: string) {
  const userId = await ctx.db.insert("users", user);
  if (avatarUrl) {
    await avatarWorkpool.enqueueAction(ctx, internal.internal.users.storeAvatar, {
      userId,
      url: avatarUrl,
    });
  }
  return userId;
}

export function insertUsernameUser(ctx: MutationCtx, method: z.infer<typeof zUsernameAuthMethod>) {
  return insertUser(ctx, { method, isVerified: false });
}

export async function getViewer(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get("users", userId);
  if (!user) return null;
  const username = user.name
    ? null
    : await ctx.runQuery(components.authUsername.public.getUsername, { userId });
  return {
    ...user,
    name: user.name ?? username ?? "Anonymous",
    imageUrl: user.imageId ? await ctx.storage.getUrl(user.imageId) : null,
  };
}

export async function replaceImage(ctx: MutationCtx, userId: Id<"users">, imageId: Id<"_storage">) {
  const user = await ctx.db.get("users", userId);
  if (!user) {
    await ctx.storage.delete(imageId);
    return;
  }
  if (user.imageId) await ctx.storage.delete(user.imageId);
  await ctx.db.patch("users", userId, { imageId });
}

export async function setBio(ctx: MutationCtx, userId: Id<"users">, bio: string) {
  await ctx.db.patch("users", userId, { bio: bio || undefined });
}
