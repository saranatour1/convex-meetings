import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zMeetingSession } from "../tables/meetingSessions";
import { audit } from "./audit";
import { recordPeerUsage } from "./usage";
import { findMember } from "./members";
import { grantedPermissions } from "./roles";
import { syncRoomPeople } from "./roomAccess";
import { getViewer } from "./users";

const LIVE_SESSIONS_READ = 50;
export const EMPTY_CALL_GRACE_MS = 2 * 60 * 1000;

type Attendance = NonNullable<Doc<"meetingSessions">["attendance"]>[number];

export const sessionPeersOf = async (
  ctx: QueryCtx,
  sessionId: Id<"meetingSessions">,
  meetingId: Id<"meetings">,
  memberId: Id<"meetingMembers">,
) => {
  const peers = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId),
    )
    .take(100);
  return peers.filter((peer) => peer.sessionId === sessionId);
};

export const updateAttendance = async (
  ctx: MutationCtx,
  sessionId: Id<"meetingSessions">,
  memberId: Id<"meetingMembers">,
  change: (entry: Attendance | undefined) => Attendance,
) => {
  const session = await ctx.db.get("meetingSessions", sessionId);
  if (!session) return;
  const attendance = session.attendance ?? [];
  const entry = attendance.find((a) => a.memberId === memberId);
  const next = entry
    ? attendance.map((a) => (a === entry ? change(entry) : a))
    : [...attendance, change(undefined)].slice(0, 1000);
  await ctx.db.patch("meetingSessions", sessionId, {
    attendance: parseOrThrow(zMeetingSession.shape.attendance, next),
  });
};

export const removePeer = async (ctx: MutationCtx, peer: Doc<"callPeers">, at: number) => {
  await ctx.db.delete("callPeers", peer._id);
  await syncRoomPeople(ctx, peer.meetingId);
  await recordPeerUsage(ctx, peer, at);
  const { joinedAt } = peer;
  if (joinedAt === undefined) return;
  if ((await sessionPeersOf(ctx, peer.sessionId, peer.meetingId, peer.memberId)).length) return;
  await updateAttendance(ctx, peer.sessionId, peer.memberId, (entry) => ({
    memberId: peer.memberId,
    joinedAt: entry?.joinedAt ?? joinedAt,
    leftAt: at,
    seconds: (entry?.seconds ?? 0) + Math.max(0, Math.round((at - joinedAt) / 1000)),
  }));
};

export const endWhenEmpty = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const someone = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
    .first();
  if (!someone) {
    await ctx.scheduler.runAfter(EMPTY_CALL_GRACE_MS, internal.internal.realtime.endIfEmpty, {
      meetingId,
    });
  }
};

const managesMeetings = async (ctx: QueryCtx, meeting: Doc<"meetings">, userId: Id<"users">) => {
  const orgMember = await findMember(ctx, meeting.orgId, userId);
  return orgMember !== null && (await grantedPermissions(ctx, orgMember._id)).has("manageMeetings");
};

export const canControlCall = async (
  ctx: QueryCtx,
  meeting: Doc<"meetings">,
  member: Doc<"meetingMembers">,
) => member.role === "host" || managesMeetings(ctx, meeting, member.userId);

export const requireCallControl = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
) => {
  const meeting = await ctx.db.get("meetings", meetingId);
  if (!meeting) throw new ConvexError("This meeting was cancelled");
  const member = await ctx.db
    .query("meetingMembers")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
    .unique();
  if (member?.role !== "host" && !(await managesMeetings(ctx, meeting, userId))) {
    throw new ConvexError("Only the host or a meeting manager can do that");
  }
  return { meeting, member };
};

export const kickLater = (
  ctx: MutationCtx,
  rtkMeetingId: string | undefined,
  member: Doc<"meetingMembers">,
) =>
  rtkMeetingId && member.rtkParticipantId
    ? ctx.scheduler.runAfter(0, internal.internal.realtime.kick, {
        rtkMeetingId,
        participantIds: [member.rtkParticipantId],
      })
    : null;

export const removeFromCall = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingMemberId: Id<"meetingMembers">,
) => {
  const target = await ctx.db.get("meetingMembers", meetingMemberId);
  if (!target) throw new ConvexError("They're not in this meeting");
  const { meeting, member } = await requireCallControl(ctx, target.meetingId, userId);
  if (target._id === member?._id) throw new ConvexError("Use Leave to leave the call yourself");
  if (target.role === "host" && member?.role !== "host") {
    throw new ConvexError("Only a host can remove another host");
  }
  await ctx.db.patch("meetingMembers", target._id, { removedAt: Date.now() });
  await kickLater(ctx, meeting.rtkMeetingId, target);
  await audit(ctx, meeting.orgId, userId, "callMemberRemoved", {
    targetUserId: target.userId,
    detail: meeting.title,
  });
};

export const letBackIn = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingMemberId: Id<"meetingMembers">,
) => {
  const target = await ctx.db.get("meetingMembers", meetingMemberId);
  if (!target) throw new ConvexError("They're not in this meeting");
  await requireCallControl(ctx, target.meetingId, userId);
  await ctx.db.patch("meetingMembers", target._id, { removedAt: undefined });
};

export const endForEveryone = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting } = await requireCallControl(ctx, meetingId, userId);
  if (!meeting.rtkMeetingId) return;
  await ctx.scheduler.runAfter(0, internal.internal.realtime.kickAll, {
    rtkMeetingId: meeting.rtkMeetingId,
  });
  await audit(ctx, meeting.orgId, userId, "callEnded", { detail: meeting.title });
};

const liveSessions = (ctx: QueryCtx, orgId: Id<"organizations">) =>
  ctx.db
    .query("meetingSessions")
    .withIndex("by_org_and_ended", (q) => q.eq("orgId", orgId).eq("endedAt", undefined))
    .order("desc")
    .take(LIVE_SESSIONS_READ);

const nameOf = async (ctx: QueryCtx, memberId: string) => {
  const id = ctx.db.normalizeId("meetingMembers", memberId);
  const member = id ? await ctx.db.get("meetingMembers", id) : null;
  return member ? ((await getViewer(ctx, member.userId))?.name ?? null) : null;
};

export const listLiveCalls = async (ctx: QueryCtx, orgId: Id<"organizations">) => {
  const sessions = await liveSessions(ctx, orgId);
  const calls = await Promise.all(
    sessions.map(async (session) => {
      const [meeting, peers] = await Promise.all([
        ctx.db.get("meetings", session.meetingId),
        ctx.db
          .query("callPeers")
          .withIndex("by_session_and_peer", (q) => q.eq("sessionId", session._id))
          .take(1000),
      ]);
      const present = [...new Set(peers.map((peer) => peer.memberId))];
      if (!meeting || present.length === 0) return null;
      const names = await Promise.all(present.slice(0, 20).map((id) => nameOf(ctx, id)));
      return {
        sessionId: session._id,
        meetingId: meeting._id,
        code: meeting.code,
        title: meeting.title,
        kind: meeting.kind,
        startedAt: session.startedAt,
        people: names.filter((name) => name !== null),
        count: present.length,
      };
    }),
  );
  return calls.filter((call) => call !== null);
};

export const kickFromOrgCalls = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
) => {
  for (const session of await liveSessions(ctx, orgId)) {
    const meeting = await ctx.db.get("meetings", session.meetingId);
    const member = await ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) =>
        q.eq("meetingId", session.meetingId).eq("userId", userId),
      )
      .unique();
    if (!meeting || !member) continue;
    await ctx.db.patch("meetingMembers", member._id, { removedAt: Date.now() });
    const inCall = await ctx.db
      .query("callPeers")
      .withIndex("by_meeting_and_member", (q) =>
        q.eq("meetingId", session.meetingId).eq("memberId", member._id),
      )
      .first();
    if (inCall) {
      await kickLater(ctx, meeting.rtkMeetingId, member);
    }
  }
};

export const forgetDevices = async (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  memberId: Id<"meetingMembers">,
  peerId?: string,
) => {
  const session = await ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .first();
  if (!session || session.endedAt) return;
  const peers = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId),
    )
    .take(100);
  for (const peer of peers) {
    if (peer.sessionId !== session._id) continue;
    if (peerId !== undefined && peer.peerId !== peerId) continue;
    await removePeer(ctx, peer, Date.now());
  }
  await endWhenEmpty(ctx, meetingId);
};
