import { zid } from "convex-helpers/server/zod4";
import { authedMutation, authedQuery } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import {
  addStroke,
  clearShareStrokes,
  listSessionSnapshots,
  listStrokes,
  requireSnapshotRights,
  saveSnapshot,
} from "../models/annotations";
import { zStroke } from "../tables/annotations";

export const strokes = authedQuery({
  args: { meetingId: zid("meetings"), shareId: zStroke.shape.shareId },
  handler: (ctx, { meetingId, shareId }) => listStrokes(ctx, ctx.userId, meetingId, shareId),
});

export const draw = authedMutation({
  args: {
    meetingId: zid("meetings"),
    shareId: zStroke.shape.shareId,
    color: zStroke.shape.color,
    points: zStroke.shape.points,
  },
  handler: async (ctx, stroke) => {
    await enforceRateLimit(ctx, "stroke", ctx.userId);
    return addStroke(ctx, ctx.userId, stroke);
  },
});

export const clear = authedMutation({
  args: { meetingId: zid("meetings"), shareId: zStroke.shape.shareId },
  handler: (ctx, { meetingId, shareId }) => clearShareStrokes(ctx, ctx.userId, meetingId, shareId),
});

export const snapshotUploadUrl = authedMutation({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    await requireSnapshotRights(ctx, ctx.userId, meetingId);
    return ctx.storage.generateUploadUrl();
  },
});

export const saveSnapshotImage = authedMutation({
  args: { meetingId: zid("meetings"), storageId: zid("_storage") },
  handler: (ctx, { meetingId, storageId }) => saveSnapshot(ctx, ctx.userId, meetingId, storageId),
});

export const snapshots = authedQuery({
  args: { sessionId: zid("meetingSessions") },
  handler: (ctx, { sessionId }) => listSessionSnapshots(ctx, ctx.userId, sessionId),
});
