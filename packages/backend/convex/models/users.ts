import type { WithoutSystemFields } from "convex/server";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { avatarWorkpool } from "../lib/workpools";
import { zUser } from "../tables/users";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const isStorableAvatar = ({ type, size }: Pick<Blob, "type" | "size">) =>
  type.startsWith("image/") && size > 0 && size <= MAX_AVATAR_BYTES;

type NewUser = WithoutSystemFields<Doc<"users">>;
type UsernameMethod = Extract<Doc<"users">["method"], "usernamePasskey" | "usernamePassword">;

export const insertUser = async (ctx: MutationCtx, user: NewUser, avatarUrl?: string) => {
  const userId = await ctx.db.insert("users", parseOrThrow(zUser, user));
  if (avatarUrl) {
    await avatarWorkpool.enqueueAction(ctx, internal.internal.users.storeAvatar, {
      userId,
      url: avatarUrl,
    });
  }
  return userId;
};

export const insertUsernameUser = (ctx: MutationCtx, method: UsernameMethod) =>
  insertUser(ctx, { method, isVerified: false });

export const getViewer = async (ctx: QueryCtx, userId: Id<"users">) => {
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
};

export const replaceImage = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  imageId: Id<"_storage">,
) => {
  const user = await ctx.db.get("users", userId);
  if (!user) {
    await ctx.storage.delete(imageId);
    return;
  }
  if (user.imageId) await ctx.storage.delete(user.imageId);
  await ctx.db.patch("users", userId, { imageId });
};

export const setBio = async (ctx: MutationCtx, userId: Id<"users">, bio: string) => {
  const parsed = parseOrThrow(zUser.shape.bio.unwrap(), bio);
  await ctx.db.patch("users", userId, { bio: parsed || undefined });
};
