import { zid } from "convex-helpers/server/zod4";
import { authedMutation, authedQuery, zPaginationOpts } from "../lib/functions";
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount as countUnread,
} from "../models/notifications";

export const list = authedQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { paginationOpts }) => listNotifications(ctx, ctx.userId, paginationOpts),
});

export const unreadCount = authedQuery({
  args: {},
  handler: (ctx) => countUnread(ctx, ctx.userId),
});

export const read = authedMutation({
  args: { notificationId: zid("notifications") },
  handler: (ctx, { notificationId }) => markRead(ctx, ctx.userId, notificationId),
});

export const readAll = authedMutation({
  args: {},
  handler: (ctx) => markAllRead(ctx, ctx.userId),
});
