import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zRing } from "../tables/rings";
import { startInstantMeeting } from "./meetings";
import { notify } from "./notifications";
import { getViewer } from "./users";

export const RING_MS = 30_000;

type NewRing = {
  orgId: Id<"organizations">;
  callerId: Id<"users">;
  calleeId: Id<"users">;
  timeZone: string;
  canManageMeetings: boolean;
};

export const startRing = async (ctx: MutationCtx, ring: NewRing) => {
  if (ring.callerId === ring.calleeId) throw new ConvexError("You can't call yourself");
  const [caller, callee] = await Promise.all([
    getViewer(ctx, ring.callerId),
    getViewer(ctx, ring.calleeId),
  ]);
  const { meetingId, code } = await startInstantMeeting(ctx, {
    orgId: ring.orgId,
    userId: ring.callerId,
    title: `${caller?.name ?? "Someone"} and ${callee?.name ?? "someone"}`.slice(0, 100),
    timeZone: ring.timeZone,
    inviteeIds: [ring.calleeId],
    canManageMeetings: ring.canManageMeetings,
    quiet: true,
  });
  const ringId = await ctx.db.insert(
    "rings",
    parseOrThrow(zRing, {
      orgId: ring.orgId,
      meetingId,
      callerId: ring.callerId,
      calleeId: ring.calleeId,
      status: "ringing",
    }),
  );
  await ctx.scheduler.runAfter(RING_MS, internal.internal.rings.expire, { ringId });
  return { code };
};

const setStatus = (ctx: MutationCtx, ring: Doc<"rings">, status: Doc<"rings">["status"]) =>
  ctx.db.patch("rings", ring._id, parseOrThrow(zRing, { ...ring, status }));

const requireRinging = async (ctx: QueryCtx, ringId: Id<"rings">) => {
  const ring = await ctx.db.get("rings", ringId);
  if (!ring || ring.status !== "ringing") throw new ConvexError("This call isn't ringing anymore");
  return ring;
};

export const answerRing = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  ringId: Id<"rings">,
  accept: boolean,
) => {
  const ring = await requireRinging(ctx, ringId);
  if (ring.calleeId !== userId) throw new ConvexError("This call isn't for you");
  const meeting = await ctx.db.get("meetings", ring.meetingId);
  if (!meeting || meeting.endedAt) {
    await setStatus(ctx, ring, "missed");
    throw new ConvexError("The call has ended");
  }
  await setStatus(ctx, ring, accept ? "accepted" : "declined");
  const member = await ctx.db
    .query("meetingMembers")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meeting._id).eq("userId", userId))
    .unique();
  if (member) {
    await ctx.db.patch("meetingMembers", member._id, {
      response: accept ? "accepted" : "declined",
    });
  }
  return { code: meeting.code };
};

export const cancelRing = async (ctx: MutationCtx, userId: Id<"users">, ringId: Id<"rings">) => {
  const ring = await requireRinging(ctx, ringId);
  if (ring.callerId !== userId) throw new ConvexError("Only the caller can hang up");
  await setStatus(ctx, ring, "cancelled");
};

export const expireRing = async (ctx: MutationCtx, ringId: Id<"rings">) => {
  const ring = await ctx.db.get("rings", ringId);
  if (!ring || ring.status !== "ringing") return;
  await setStatus(ctx, ring, "missed");
  const meeting = await ctx.db.get("meetings", ring.meetingId);
  await notify(ctx, [ring.calleeId], {
    kind: "missedCall",
    title: meeting?.title ?? "a call",
    actorId: ring.callerId,
  });
};

export const incomingRing = async (ctx: QueryCtx, userId: Id<"users">) => {
  const ring = await ctx.db
    .query("rings")
    .withIndex("by_callee_and_status", (q) => q.eq("calleeId", userId).eq("status", "ringing"))
    .order("desc")
    .first();
  if (!ring) return null;
  const caller = await getViewer(ctx, ring.callerId);
  return {
    _id: ring._id,
    callerName: caller?.name ?? "Someone",
    callerImageUrl: caller?.imageUrl ?? null,
  };
};

export const outgoingRing = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const ring = await ctx.db
    .query("rings")
    .withIndex("by_meeting_and_caller", (q) => q.eq("meetingId", meetingId).eq("callerId", userId))
    .order("desc")
    .first();
  if (!ring) return null;
  const callee = await getViewer(ctx, ring.calleeId);
  return { _id: ring._id, status: ring.status, calleeName: callee?.name ?? "Someone" };
};
