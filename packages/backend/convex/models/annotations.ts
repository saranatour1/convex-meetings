import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zAnnotationSnapshot, zStroke } from "../tables/annotations";
import { canControlCall } from "./calls";
import { requireMeetingMember, requireSessionAccess } from "./meetingAccess";
import { isPublicRoom } from "./roomAccess";
import { getViewer } from "./users";

const STROKES_READ = 500;
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

type ShareRef = { meetingId: Id<"meetings">; shareId: string };

const requireInCall = async (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) => {
  const found = await requireMeetingMember(ctx, meetingId, userId);
  if (found.member.removedAt) throw new ConvexError("The host removed you from this meeting");
  return found;
};

const requireDrawing = (meeting: Doc<"meetings">) => {
  if (isPublicRoom(meeting)) throw new ConvexError("Drawing is off in public rooms");
};

const isLocked = async (ctx: QueryCtx, { meetingId, shareId }: ShareRef) =>
  (await ctx.db
    .query("annotationLocks")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId).eq("shareId", shareId))
    .unique()) !== null;

const requireUnlocked = async (ctx: QueryCtx, share: ShareRef, member: Doc<"meetingMembers">) => {
  if (share.shareId !== member._id && (await isLocked(ctx, share))) {
    throw new ConvexError("The presenter turned drawing off");
  }
};

const canClearShare = async (
  ctx: QueryCtx,
  meeting: Doc<"meetings">,
  member: Doc<"meetingMembers">,
  shareId: string,
) => shareId === member._id || (await canControlCall(ctx, meeting, member));

export const listStrokes = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  shareId: string,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) =>
      q.eq("meetingId", meetingId).eq("shareId", shareId).eq("removedAt", undefined),
    )
    .take(STROKES_READ);
  return {
    strokes: strokes.map((s) => ({
      _id: s._id,
      tool: s.tool ?? "pen",
      color: s.color,
      points: s.points,
      text: s.text,
      mine: s.memberId === member._id,
    })),
    locked: await isLocked(ctx, { meetingId, shareId }),
    presenter: shareId === member._id,
    canClear: await canClearShare(ctx, meeting, member, shareId),
  };
};

export const addStroke = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  stroke: Pick<
    ReturnType<typeof zStroke.parse>,
    "meetingId" | "shareId" | "tool" | "color" | "points" | "text"
  >,
) => {
  const { meeting, member } = await requireInCall(ctx, stroke.meetingId, userId);
  requireDrawing(meeting);
  await requireUnlocked(ctx, stroke, member);
  return ctx.db.insert("strokes", parseOrThrow(zStroke, { ...stroke, memberId: member._id }));
};

export const setStrokesRemoved = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  { meetingId, shareId, ids }: ShareRef & { ids: Id<"strokes">[] },
  removed: boolean,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  requireDrawing(meeting);
  if (!removed) await requireUnlocked(ctx, { meetingId, shareId }, member);
  let canClear: boolean | undefined;
  let changed = 0;
  for (const id of ids) {
    const stroke = await ctx.db.get("strokes", id);
    if (!stroke || stroke.meetingId !== meetingId || stroke.shareId !== shareId) continue;
    if ((stroke.removedAt !== undefined) === removed) continue;
    if (stroke.memberId !== member._id) {
      canClear ??= await canClearShare(ctx, meeting, member, shareId);
      if (!canClear) {
        throw new ConvexError("Only the presenter or the host can erase other people's marks");
      }
    }
    await ctx.db.patch("strokes", id, { removedAt: removed ? Date.now() : undefined });
    changed += 1;
  }
  return changed;
};

export const setShareLock = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  { meetingId, shareId, locked }: ShareRef & { locked: boolean },
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  requireDrawing(meeting);
  if (!(await canClearShare(ctx, meeting, member, shareId))) {
    throw new ConvexError("Only the presenter or the host can choose who draws");
  }
  const lock = await ctx.db
    .query("annotationLocks")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId).eq("shareId", shareId))
    .unique();
  if (locked && !lock) await ctx.db.insert("annotationLocks", { meetingId, shareId });
  if (!locked && lock) await ctx.db.delete("annotationLocks", lock._id);
};

export const clearShareStrokes = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  shareId: string,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  if (!(await canClearShare(ctx, meeting, member, shareId))) {
    throw new ConvexError("Only the presenter or the host can clear the drawing");
  }
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId).eq("shareId", shareId))
    .take(STROKES_READ * 2);
  for (const stroke of strokes) await ctx.db.delete("strokes", stroke._id);
};

export const clearStrokes = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const stroke of strokes) await ctx.db.delete("strokes", stroke._id);
  const locks = await ctx.db
    .query("annotationLocks")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId))
    .take(100);
  for (const lock of locks) await ctx.db.delete("annotationLocks", lock._id);
};
export const requireSnapshotRights = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  if (isPublicRoom(meeting)) throw new ConvexError("Snapshots are off in public rooms");
  if (meeting.protected && !(await canControlCall(ctx, meeting, member))) {
    throw new ConvexError("In a protected meeting only the host can save annotations");
  }
  return member;
};

export const saveSnapshot = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  storageId: Id<"_storage">,
) => {
  const member = await requireSnapshotRights(ctx, userId, meetingId);
  const file = await ctx.db.system.get("_storage", storageId);
  if (!file || file.contentType !== "image/png" || file.size > MAX_SNAPSHOT_BYTES) {
    await ctx.storage.delete(storageId);
    throw new ConvexError("Snapshots must be PNG images under 10 MB");
  }
  return ctx.db.insert(
    "annotationSnapshots",
    parseOrThrow(zAnnotationSnapshot, { meetingId, memberId: member._id, storageId }),
  );
};

export const listSessionSnapshots = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  sessionId: Id<"meetingSessions">,
) => {
  const { session } = await requireSessionAccess(ctx, userId, sessionId);
  const snapshots = await ctx.db
    .query("annotationSnapshots")
    .withIndex("by_meeting", (q) => {
      const range = q.eq("meetingId", session.meetingId).gte("_creationTime", session.startedAt);
      return session.endedAt === undefined ? range : range.lte("_creationTime", session.endedAt);
    })
    .take(100);
  return Promise.all(
    snapshots.map(async (snapshot) => {
      const author = await ctx.db.get("meetingMembers", snapshot.memberId);
      const user = author && (await getViewer(ctx, author.userId));
      return {
        _id: snapshot._id,
        _creationTime: snapshot._creationTime,
        url: await ctx.storage.getUrl(snapshot.storageId),
        authorName: user?.name ?? "Someone",
      };
    }),
  );
};
