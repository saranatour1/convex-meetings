import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zCallPeer } from "../tables/callPeers";
import { clearStrokes } from "./annotations";
import {
  canControlCall,
  endWhenEmpty,
  removePeer,
  sessionPeersOf,
  updateAttendance,
} from "./calls";
import { requireMeetingMember, requireSessionAccess } from "./meetingAccess";
import { notify } from "./notifications";
import {
  ROOM_CAPACITY,
  findRoom,
  isPublicRoom,
  requireNotBanned,
  syncRoomPeople,
} from "./roomAccess";
import { queueSummaryCheck } from "./moderationQueue";
import { liveTextOn, recordRecordingStatus, recordTranscriptUsage } from "./usage";
import { getViewer } from "./users";

const sessionPeersOfMember = (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  memberId: Id<"meetingMembers">,
) =>
  ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId),
    )
    .first();

export const joinDetails = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  if (meeting.endedAt) throw new ConvexError("This meeting has ended");
  if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
  const open = isPublicRoom(meeting);
  if (open) {
    await requireNotBanned(ctx, meeting.orgId, userId);
    const [room, here] = await Promise.all([
      findRoom(ctx, meetingId),
      sessionPeersOfMember(ctx, meetingId, member._id),
    ]);
    if (!here && (room?.people ?? 0) >= ROOM_CAPACITY) throw new ConvexError("This room is full");
  }
  const user = await getViewer(ctx, userId);
  return {
    title: meeting.title,
    kind: meeting.kind,
    recap: meeting.recap,
    record: !open && !meeting.protected && (meeting.record ?? false),
    rtkMeetingId: meeting.rtkMeetingId ?? null,
    memberId: member._id,
    role: member.role,
    rtkParticipantId: member.rtkParticipantId ?? null,
    rtkPreset: member.rtkPreset ?? null,
    name: user?.name ?? "Guest",
    imageUrl: open && !user?.agent ? undefined : (user?.imageUrl ?? undefined),
    viewer: (open && user?.method === "guest") || Boolean(user?.agent),
    isGuest: user?.method === "guest",
    agent: user?.agent ?? null,
  };
};

export type JoinDetails = Awaited<ReturnType<typeof joinDetails>>;

export const claimRtkMeeting = async (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  rtkMeetingId: string,
) => {
  const meeting = await ctx.db.get("meetings", meetingId);
  if (!meeting) throw new ConvexError("This meeting was cancelled");
  if (meeting.rtkMeetingId) return meeting.rtkMeetingId;
  await ctx.db.patch("meetings", meetingId, { rtkMeetingId });
  return rtkMeetingId;
};

export const setRtkParticipant = (
  ctx: MutationCtx,
  memberId: Id<"meetingMembers">,
  rtkParticipantId: string,
  rtkPreset: string,
) => ctx.db.patch("meetingMembers", memberId, { rtkParticipantId, rtkPreset });

export type RealtimeEvent = {
  event: string;
  meeting?: { id?: string; sessionId?: string; startedAt?: string; endedAt?: string };
  participant?: { customParticipantId?: string; peerId?: string };
  summaryDownloadUrl?: string;
  transcriptDownloadUrl?: string;
  recording?: {
    downloadUrl?: string;
    status?: string;
    outputFileName?: string;
    recordingDuration?: number;
  };
  summary?: string;
  transcriptId?: Id<"_storage">;
  recordingKey?: string;
};

const toMillis = (value: string | undefined, fallback: number) =>
  value ? Date.parse(value) || fallback : fallback;

const nextSessionNumber = async (ctx: QueryCtx, meetingId: Id<"meetings">) => {
  const last = await ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting_and_number", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .first();
  return (last?.number ?? 0) + 1;
};

const peerOf = (ctx: QueryCtx, sessionId: Id<"meetingSessions">, peerId: string) =>
  ctx.db
    .query("callPeers")
    .withIndex("by_session_and_peer", (q) => q.eq("sessionId", sessionId).eq("peerId", peerId))
    .first();

const trackPeers = async (
  ctx: MutationCtx,
  session: Doc<"meetingSessions">,
  event: RealtimeEvent,
  now: number,
) => {
  const attendee = event.participant?.customParticipantId;
  const peerId = event.participant?.peerId ?? attendee;
  if (event.event === "meeting.participantJoined" && attendee && peerId && !session.endedAt) {
    const memberId = ctx.db.normalizeId("meetingMembers", attendee);
    if (memberId && !(await peerOf(ctx, session._id, peerId))) {
      const others = await sessionPeersOf(ctx, session._id, session.meetingId, memberId);
      await ctx.db.insert(
        "callPeers",
        parseOrThrow(zCallPeer, {
          sessionId: session._id,
          meetingId: session.meetingId,
          memberId,
          peerId,
          joinedAt: others[0]?.joinedAt ?? now,
          connectedAt: now,
          liveText: await liveTextOn(ctx),
        }),
      );
      await syncRoomPeople(ctx, session.meetingId);
      if (!others.length) {
        await updateAttendance(ctx, session._id, memberId, (entry) => ({
          memberId,
          joinedAt: entry?.joinedAt ?? now,
          seconds: entry?.seconds ?? 0,
        }));
      }
    }
  }
  if (event.event === "meeting.participantLeft" && peerId) {
    const peer = await peerOf(ctx, session._id, peerId);
    if (peer) await removePeer(ctx, peer, now);
    await endWhenEmpty(ctx, session.meetingId);
  }
  if (event.event === "meeting.ended") {
    const peers = await ctx.db
      .query("callPeers")
      .withIndex("by_session_and_peer", (q) => q.eq("sessionId", session._id))
      .take(1000);
    const endedAt = toMillis(event.meeting?.endedAt, now);
    for (const peer of peers) await removePeer(ctx, peer, endedAt);
    await endWhenEmpty(ctx, session.meetingId);
  }
};

const startSession = async (
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  rtkSessionId: string,
  startedAt: number,
) => {
  const stale = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meeting._id))
    .take(1000);
  for (const peer of stale) await ctx.db.delete("callPeers", peer._id);
  await syncRoomPeople(ctx, meeting._id);
  const sessionId = await ctx.db.insert("meetingSessions", {
    meetingId: meeting._id,
    orgId: meeting.orgId,
    number: await nextSessionNumber(ctx, meeting._id),
    rtkSessionId,
    startedAt,
    attendeeIds: [],
  });
  return (await ctx.db.get("meetingSessions", sessionId))!;
};

export const recordRealtimeEvent = async (ctx: MutationCtx, event: RealtimeEvent) => {
  const rtkMeetingId = event.meeting?.id;
  const rtkSessionId = event.meeting?.sessionId;
  if (!rtkMeetingId || !rtkSessionId) return;
  const meeting = await ctx.db
    .query("meetings")
    .withIndex("by_rtk_meeting", (q) => q.eq("rtkMeetingId", rtkMeetingId))
    .first();
  if (!meeting) return;
  const now = Date.now();
  const existing = await ctx.db
    .query("meetingSessions")
    .withIndex("by_rtk_session", (q) => q.eq("rtkSessionId", rtkSessionId))
    .unique();
  const session =
    existing ??
    (await startSession(ctx, meeting, rtkSessionId, toMillis(event.meeting?.startedAt, now)));
  const attendee = event.participant?.customParticipantId;
  const patch: Partial<Doc<"meetingSessions">> = {};
  if (attendee && !session.attendeeIds.includes(attendee)) {
    patch.attendeeIds = [...session.attendeeIds, attendee].slice(0, 1000);
  }
  if (!session.orgId) patch.orgId = meeting.orgId;
  if (event.event === "meeting.ended") {
    patch.endedAt = toMillis(event.meeting?.endedAt, now);
    await clearStrokes(ctx, meeting._id);
  }
  if (event.summary) patch.summary = event.summary.slice(0, 20_000);
  if (event.transcriptDownloadUrl) patch.transcriptUrl = event.transcriptDownloadUrl;
  if (event.transcriptId) patch.transcriptId = event.transcriptId;
  Object.assign(patch, await recordRecordingStatus(ctx, session, event.recording?.status, now));
  if (event.event === "meeting.transcript" && !session.transcriptId && !session.transcriptUrl) {
    await recordTranscriptUsage(ctx, session, now);
  }
  if (event.recording?.status === "UPLOADED") {
    if (event.recording.downloadUrl) patch.recordingUrl = event.recording.downloadUrl;
    if (event.recordingKey) patch.recordingKey = event.recordingKey;
    if (event.recording.recordingDuration) {
      patch.recordingSeconds = event.recording.recordingDuration;
    }
  }
  if (Object.keys(patch).length) await ctx.db.patch("meetingSessions", session._id, patch);
  await trackPeers(ctx, session, event, now);
  if (event.summary && !session.summary && isPublicRoom(meeting)) {
    await queueSummaryCheck(ctx, session._id);
  }
  if (event.summary && !session.summary && !isPublicRoom(meeting)) {
    const members = await ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meeting._id))
      .take(1000);
    await notify(
      ctx,
      members.map((m) => m.userId),
      {
        kind: "recapReady",
        title: meeting.title,
        meetingCode: meeting.code,
        sessionId: session._id,
      },
    );
  }
};

const meetingNames = async (ctx: QueryCtx, memberIds: string[]) => {
  const names = await Promise.all(
    memberIds.map(async (memberId) => {
      const id = ctx.db.normalizeId("meetingMembers", memberId);
      const member = id ? await ctx.db.get("meetingMembers", id) : null;
      const user = member ? await getViewer(ctx, member.userId) : null;
      return user?.name ?? null;
    }),
  );
  return names.filter((name) => name !== null);
};

export const getRecap = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  sessionId: Id<"meetingSessions">,
) => {
  const { meeting, session } = await requireSessionAccess(ctx, userId, sessionId);
  const { member } = await requireMeetingMember(ctx, meeting._id, userId);
  return {
    sessionId: session._id,
    meeting: { title: meeting.title, code: meeting.code, kind: meeting.kind },
    canDownload: !meeting.protected || (await canControlCall(ctx, meeting, member)),
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
    attendees: await meetingNames(ctx, session.attendeeIds),
    attendance: await Promise.all(
      (session.attendance ?? []).map(async (entry) => {
        const member = await ctx.db.get("meetingMembers", entry.memberId);
        const user = member ? await getViewer(ctx, member.userId) : null;
        return {
          memberId: entry.memberId,
          name: user?.name ?? "Guest",
          joinedAt: entry.joinedAt,
          leftAt: entry.leftAt ?? null,
          seconds: entry.seconds,
        };
      }),
    ),
    summary: session.summary ?? null,
    transcriptUrl: session.transcriptId ? await ctx.storage.getUrl(session.transcriptId) : null,
    hasRecording: Boolean(session.recordingKey || session.recordingUrl),
    recordingSeconds: session.recordingSeconds ?? null,
  };
};
