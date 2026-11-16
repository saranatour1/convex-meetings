import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zNotification } from "../tables/notifications";
import { getViewer } from "./users";

type NewNotification = Omit<typeof zNotification._input, "userId" | "readAt">;

const UNREAD_CAP = 99;

export const notify = async (
  ctx: MutationCtx,
  userIds: Id<"users">[],
  notification: NewNotification,
) => {
  for (const userId of new Set(userIds)) {
    if (userId === notification.actorId) continue;
    await ctx.db.insert("notifications", parseOrThrow(zNotification, { ...notification, userId }));
  }
};

export const listNotifications = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (n) => {
      const [actor, session] = await Promise.all([
        n.actorId ? getViewer(ctx, n.actorId) : null,
        n.sessionId ? ctx.db.get("meetingSessions", n.sessionId) : null,
      ]);
      return {
        ...n,
        sessionNumber: session?.number ?? null,
        actorName: actor?.name ?? null,
        actorImageUrl: actor?.imageUrl ?? null,
      };
    }),
  );
  return { ...result, page };
};

export const unreadCount = async (ctx: QueryCtx, userId: Id<"users">) => {
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_user_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
    .take(UNREAD_CAP + 1);
  return unread.length;
};

export const markRead = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  notificationId: Id<"notifications">,
) => {
  const notification = await ctx.db.get("notifications", notificationId);
  if (!notification || notification.userId !== userId) throw new ConvexError("Not found");
  if (!notification.readAt)
    await ctx.db.patch("notifications", notificationId, { readAt: Date.now() });
};

export const markAllRead = async (ctx: MutationCtx, userId: Id<"users">) => {
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_user_and_readAt", (q) => q.eq("userId", userId).eq("readAt", undefined))
    .take(500);
  const now = Date.now();
  await Promise.all(unread.map((n) => ctx.db.patch("notifications", n._id, { readAt: now })));
};
