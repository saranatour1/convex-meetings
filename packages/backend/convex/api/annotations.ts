import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import { authedQuery, meetingMutation, meetingQuery } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import {
  addStroke,
  clearShareStrokes,
  listSessionSnapshots,
  listStrokes,
  requireSnapshotRights,
  saveSnapshot,
  setShareLock,
  setStrokesRemoved,
} from "../models/annotations";
import { findMeetingAccess } from "../models/meetingAccess";
import { zStroke } from "../tables/annotations";

const share = { meetingId: zid("meetings"), shareId: zStroke.shape.shareId };
const marks = { ...share, ids: z.array(zid("strokes")).min(1).max(100) };

export const strokes = meetingQuery({
  args: share,
  handler: async (ctx, { meetingId, shareId }) => {
    const access = await findMeetingAccess(ctx, meetingId, ctx.userId);
    if (!access || access.member.removedAt) return null;
    return listStrokes(ctx, access.member.userId, meetingId, shareId);
  },
});

export const draw = meetingMutation({
  args: {
    ...share,
    tool: zStroke.shape.tool,
    color: zStroke.shape.color,
    points: zStroke.shape.points,
    text: zStroke.shape.text,
  },
  handler: async (ctx, stroke) => {
    await enforceRateLimit(ctx, "stroke", ctx.userId);
    return addStroke(ctx, ctx.userId, stroke);
  },
});

export const remove = meetingMutation({
  args: marks,
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "stroke", ctx.userId);
    return setStrokesRemoved(ctx, ctx.userId, args, true);
  },
});

export const restore = meetingMutation({
  args: marks,
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, "stroke", ctx.userId);
    return setStrokesRemoved(ctx, ctx.userId, args, false);
  },
});

export const lock = meetingMutation({
  args: { ...share, locked: z.boolean() },
  handler: (ctx, args) => setShareLock(ctx, ctx.userId, args),
});

export const clear = meetingMutation({
  args: share,
  handler: (ctx, { meetingId, shareId }) => clearShareStrokes(ctx, ctx.userId, meetingId, shareId),
});

export const snapshotUploadUrl = meetingMutation({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    await requireSnapshotRights(ctx, ctx.userId, meetingId);
    return ctx.storage.generateUploadUrl();
  },
});

export const saveSnapshotImage = meetingMutation({
  args: { meetingId: zid("meetings"), storageId: zid("_storage") },
  handler: (ctx, { meetingId, storageId }) => saveSnapshot(ctx, ctx.userId, meetingId, storageId),
});

export const snapshots = authedQuery({
  args: { sessionId: zid("meetingSessions") },
  handler: (ctx, { sessionId }) => listSessionSnapshots(ctx, ctx.userId, sessionId),
});
