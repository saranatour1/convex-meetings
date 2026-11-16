import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zAnnotationSnapshot, zStroke } from "../tables/annotations";
import { canControlCall } from "./calls";
import { requireMeetingMember, requireSessionAccess } from "./meetings";
import { getViewer } from "./users";

const STROKES_READ = 500;
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

const requireInCall = async (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) => {
  const found = await requireMeetingMember(ctx, meetingId, userId);
  if (found.member.removedAt) throw new ConvexError("The host removed you from this meeting");
  return found;
};

export const listStrokes = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  shareId: string,
) => {
  await requireInCall(ctx, meetingId, userId);
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId).eq("shareId", shareId))
    .take(STROKES_READ);
  return strokes.map((s) => ({
    _id: s._id,
    color: s.color,
    points: s.points,
    memberId: s.memberId,
  }));
};

export const addStroke = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  stroke: Pick<ReturnType<typeof zStroke.parse>, "meetingId" | "shareId" | "color" | "points">,
) => {
  const { member } = await requireInCall(ctx, stroke.meetingId, userId);
  return ctx.db.insert("strokes", parseOrThrow(zStroke, { ...stroke, memberId: member._id }));
};

export const clearShareStrokes = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  shareId: string,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
  const own = shareId === member._id;
  if (!own && !(await canControlCall(ctx, meeting, member))) {
    throw new ConvexError("Only the presenter or the host can clear the drawing");
  }
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId).eq("shareId", shareId))
    .take(STROKES_READ);
  for (const stroke of strokes) await ctx.db.delete("strokes", stroke._id);
};

export const clearStrokes = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const strokes = await ctx.db
    .query("strokes")
    .withIndex("by_meeting_and_share", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const stroke of strokes) await ctx.db.delete("strokes", stroke._id);
};

export const requireSnapshotRights = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, member } = await requireInCall(ctx, meetingId, userId);
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
