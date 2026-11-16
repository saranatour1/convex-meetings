import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import { DateTime } from "luxon";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zMeeting } from "../tables/meetings";
import { zMeetingMember } from "../tables/meetingMembers";
import { zMeetingTime } from "../tables/meetingTimes";
import { zMessage } from "../tables/messages";
import { clearStrokes } from "./annotations";
import { canControlCall } from "./calls";
import { findMember } from "./members";
import { notify } from "./notifications";
import { getSettings } from "./settings";
import { getViewer } from "./users";

const MAX_INVITEES = 100;
const CODE_LETTERS = "abcdefghijkmnopqrstuvwxyz";
const MAX_MEMBERS_READ = 200;
const DAY_MS = 86_400_000;

type NewMeeting = {
  orgId: Id<"organizations">;
  userId: Id<"users">;
  title: string;
  kind: Doc<"meetings">["kind"];
  recap: boolean;
  startsAt: number;
  minutes: number;
  timeZone: string;
  rrule?: string;
  inviteeIds: Id<"users">[];
  canManageMeetings: boolean;
  protected?: boolean;
};

export const meetingTime = (startsAt: number, minutes: number, timeZone: string) => {
  const start = DateTime.fromMillis(startsAt, { zone: timeZone });
  const end = start.plus({ minutes });
  if (!start.isValid) throw new ConvexError("Unknown time zone");
  if (minutes < 5 || minutes > 12 * 60)
    throw new ConvexError("Meetings last 5 minutes to 12 hours");
  if (!start.hasSame(end, "day") || end.toFormat("HH:mm") <= start.toFormat("HH:mm")) {
    throw new ConvexError("A meeting has to end on the day it starts");
  }
  return {
    date: Math.round(
      DateTime.fromISO(start.toISODate() ?? "", { zone: "utc" }).toMillis() / DAY_MS,
    ),
    start: start.toFormat("HH:mm"),
    end: end.toFormat("HH:mm"),
    timeZone,
    startsAt: start.toMillis(),
    endsAt: end.toMillis(),
  };
};

const randomCode = () => {
  const letters = [...crypto.getRandomValues(new Uint8Array(10))].map(
    (byte) => CODE_LETTERS[byte % CODE_LETTERS.length],
  );
  return `${letters.slice(0, 3).join("")}-${letters.slice(3, 7).join("")}-${letters.slice(7).join("")}`;
};

export const findMeetingByCode = (ctx: QueryCtx, code: string) =>
  ctx.db
    .query("meetings")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

export const uniqueMeetingCode = async (ctx: QueryCtx) => {
  for (;;) {
    const code = randomCode();
    if (!(await findMeetingByCode(ctx, code))) return code;
  }
};

export const createMeeting = async (ctx: MutationCtx, meeting: NewMeeting) => {
  const inviteeIds = [...new Set(meeting.inviteeIds)].filter((id) => id !== meeting.userId);
  if (inviteeIds.length > MAX_INVITEES)
    throw new ConvexError(`Invite at most ${MAX_INVITEES} people`);
  for (const userId of inviteeIds) {
    if (!(await findMember(ctx, meeting.orgId, userId))) {
      throw new ConvexError("Only members of this organization can be invited");
    }
    const settings = await getSettings(ctx, userId);
    if (settings.invitesFrom === "managers" && !meeting.canManageMeetings) {
      const invitee = await getViewer(ctx, userId);
      throw new ConvexError(`${invitee?.name ?? "Someone"} only accepts invites from organizers`);
    }
  }
  const { autoRecord } = await getSettings(ctx, meeting.userId);
  const time = meetingTime(meeting.startsAt, meeting.minutes, meeting.timeZone);
  const code = await uniqueMeetingCode(ctx);
  const meetingId = await ctx.db.insert(
    "meetings",
    parseOrThrow(zMeeting, {
      code,
      orgId: meeting.orgId,
      userId: meeting.userId,
      title: meeting.title,
      kind: meeting.kind,
      recap: meeting.recap,
      record: autoRecord,
      protected: meeting.protected || undefined,
    }),
  );
  await ctx.db.insert(
    "meetingTimes",
    parseOrThrow(zMeetingTime, { ...time, meetingId, rrule: meeting.rrule || undefined }),
  );
  const members = [
    { userId: meeting.userId, role: "host" as const, response: "accepted" as const },
    ...inviteeIds.map((userId) => ({
      userId,
      role: "participant" as const,
      response: "pending" as const,
    })),
  ];
  for (const member of members) {
    await ctx.db.insert("meetingMembers", parseOrThrow(zMeetingMember, { ...member, meetingId }));
  }
  await notify(ctx, inviteeIds, {
    kind: "meetingInvite",
    title: meeting.title,
    meetingCode: code,
    actorId: meeting.userId,
  });
  return { meetingId, code };
};

const timeOf = (ctx: QueryCtx, meetingId: Id<"meetings">) =>
  ctx.db
    .query("meetingTimes")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .first();

export const requireMeetingMember = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
) => {
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", meetingId),
    ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
      .unique(),
  ]);
  if (!meeting || !member) throw new ConvexError("You're not invited to this meeting");
  return { meeting, member };
};

export const listMyMeetings = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  paginationOpts: PaginationOptions,
) => {
  const memberships = await ctx.db
    .query("meetingMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    memberships.page.map(async (membership) => {
      const [meeting, time, lastSession] = await Promise.all([
        ctx.db.get("meetings", membership.meetingId),
        timeOf(ctx, membership.meetingId),
        ctx.db
          .query("meetingSessions")
          .withIndex("by_meeting", (q) => q.eq("meetingId", membership.meetingId))
          .order("desc")
          .first(),
      ]);
      if (!meeting || !time) return null;
      return {
        _id: meeting._id,
        code: meeting.code,
        title: meeting.title,
        kind: meeting.kind,
        startsAt: time.startsAt,
        endsAt: time.endsAt,
        timeZone: time.timeZone,
        rrule: time.rrule ?? null,
        response: membership.response,
        role: membership.role,
        lastSession: lastSession
          ? {
              _id: lastSession._id,
              number: lastSession.number,
              startedAt: lastSession.startedAt,
              hasSummary: Boolean(lastSession.summary),
              hasRecording: Boolean(lastSession.recordingKey || lastSession.recordingUrl),
            }
          : null,
      };
    }),
  );
  return { ...memberships, page: page.filter((m) => m !== null) };
};

export const getMeeting = async (ctx: QueryCtx, userId: Id<"users">, meetingId: Id<"meetings">) => {
  const [meeting, member, viewer] = await Promise.all([
    ctx.db.get("meetings", meetingId),
    ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
      .unique(),
    ctx.db.get("users", userId),
  ]);
  if (!meeting || !member) return null;
  const isGuest = viewer?.method === "guest";
  const openSession = await ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .first();
  const devicesInCall =
    openSession && !openSession.endedAt
      ? (openSession.presentPeers ?? []).filter((peer) => peer.memberId === member._id).length
      : 0;
  const canControl = !isGuest && (await canControlCall(ctx, meeting, member));
  const [time, members, sessions] = await Promise.all([
    timeOf(ctx, meetingId),
    ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId))
      .take(MAX_MEMBERS_READ),
    ctx.db
      .query("meetingSessions")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .order("desc")
      .take(20),
  ]);
  const people = await Promise.all(
    members.map(async (m) => {
      const user = await getViewer(ctx, m.userId);
      return {
        _id: m._id,
        name: user?.name ?? "Anonymous",
        imageUrl: user?.imageUrl ?? null,
        role: m.role,
        response: m.response,
        removed: Boolean(m.removedAt),
        isGuest: user?.method === "guest",
      };
    }),
  );
  return {
    _id: meeting._id,
    code: meeting.code,
    orgId: meeting.orgId,
    title: meeting.title,
    kind: meeting.kind,
    recap: meeting.recap,
    protected: meeting.protected ?? false,
    access: meeting.access ?? "invited",
    inviters: meeting.inviters ?? "hosts",
    time,
    me: {
      _id: member._id,
      role: member.role,
      response: member.response,
      removed: Boolean(member.removedAt),
      devicesInCall,
      isGuest,
      canControl,
      canInvite: !isGuest && (canControl || (meeting.inviters ?? "hosts") === "everyone"),
    },
    people,
    sessions: sessions.map((s) => ({
      _id: s._id,
      number: s.number,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      attendees: s.attendeeIds.length,
      summary: s.summary ?? null,
      transcriptUrl: s.transcriptUrl ?? null,
      recordingUrl: s.recordingUrl ?? null,
    })),
  };
};

export const respond = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  response: Doc<"meetingMembers">["response"],
) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  if (member.response === response) return;
  await ctx.db.patch("meetingMembers", member._id, { response });
  if (response !== "pending") {
    await notify(ctx, [meeting.userId], {
      kind: "rsvp",
      title: meeting.title,
      detail: response === "accepted" ? "is going" : "can't make it",
      meetingCode: meeting.code,
      actorId: userId,
    });
  }
};

const deleteAll = async (
  ctx: MutationCtx,
  docs: {
    _id: Id<
      "meetingTimes" | "meetingMembers" | "messages" | "meetingSessions" | "annotationSnapshots"
    >;
  }[],
) => {
  for (const doc of docs) await ctx.db.delete(doc._id);
};

export const cancelMeeting = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  if (member.role !== "host") throw new ConvexError("Only the host can cancel this meeting");
  const byMeeting = (table: "meetingTimes" | "messages" | "meetingSessions") =>
    ctx.db
      .query(table)
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .take(1000);
  await deleteAll(ctx, await byMeeting("meetingTimes"));
  await deleteAll(ctx, await byMeeting("messages"));
  await deleteAll(ctx, await byMeeting("meetingSessions"));
  await clearStrokes(ctx, meetingId);
  const snapshots = await ctx.db
    .query("annotationSnapshots")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const snapshot of snapshots) await ctx.storage.delete(snapshot.storageId);
  await deleteAll(ctx, snapshots);
  const guests = await ctx.db
    .query("meetingGuests")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const guest of guests) {
    await ctx.db.delete("tokens", guest.tokenId);
    await ctx.db.delete("users", guest.userId);
    await ctx.db.delete("meetingGuests", guest._id);
  }
  const members = await ctx.db
    .query("meetingMembers")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  const guestIds = new Set(guests.map((guest) => guest.userId));
  await notify(
    ctx,
    members.map((m) => m.userId).filter((id) => !guestIds.has(id)),
    { kind: "meetingCancelled", title: meeting.title, actorId: userId },
  );
  await deleteAll(ctx, members);
  await ctx.db.delete("meetings", meetingId);
  return meeting.rtkMeetingId ?? null;
};

export const busyForOrg = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  from: number,
  to: number,
) => {
  const members = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_READ);
  const entries = await Promise.all(
    members.map(async (member) => {
      const memberships = await ctx.db
        .query("meetingMembers")
        .withIndex("by_user", (q) => q.eq("userId", member.userId))
        .order("desc")
        .take(MAX_MEMBERS_READ);
      const times = await Promise.all(
        memberships.filter((m) => m.response !== "declined").map((m) => timeOf(ctx, m.meetingId)),
      );
      const busy = times
        .filter((t) => t !== null && t.startsAt < to && t.endsAt > from)
        .map((t) => ({ start: t!.startsAt, end: t!.endsAt }));
      return [member.userId, busy] as const;
    }),
  );
  return Object.fromEntries(entries);
};

const describeMessage = async (ctx: QueryCtx, message: Doc<"messages">, userId: Id<"users">) => {
  const author = await ctx.db.get("meetingMembers", message.meetingMemberId);
  const user = author && (await getViewer(ctx, author.userId));
  return {
    _id: message._id,
    _creationTime: message._creationTime,
    body: message.body,
    authorId: message.meetingMemberId,
    authorName: user?.name ?? "Someone",
    authorImageUrl: user?.imageUrl ?? null,
    mine: author?.userId === userId,
  };
};

export const listMessages = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  paginationOpts: PaginationOptions,
  userId: Id<"users">,
) => {
  const result = await ctx.db
    .query("messages")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .paginate(paginationOpts);
  return {
    ...result,
    page: await Promise.all(result.page.map((m) => describeMessage(ctx, m, userId))),
  };
};

export const listSessionMessages = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  sessionId: Id<"meetingSessions">,
  paginationOpts: PaginationOptions,
) => {
  const { session } = await requireSessionAccess(ctx, userId, sessionId);
  const result = await ctx.db
    .query("messages")
    .withIndex("by_meeting", (q) =>
      q
        .eq("meetingId", session.meetingId)
        .gte("_creationTime", session.startedAt)
        .lte("_creationTime", session.endedAt ?? Date.now()),
    )
    .paginate(paginationOpts);
  return {
    ...result,
    page: await Promise.all(result.page.map((m) => describeMessage(ctx, m, userId))),
  };
};

export const sendMessage = (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  meetingMemberId: Id<"meetingMembers">,
  body: string,
) => ctx.db.insert("messages", parseOrThrow(zMessage, { meetingId, meetingMemberId, body }));

export const joinDetails = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
  const user = await getViewer(ctx, userId);
  return {
    title: meeting.title,
    kind: meeting.kind,
    recap: meeting.recap,
    record: !meeting.protected && (meeting.record ?? false),
    rtkMeetingId: meeting.rtkMeetingId ?? null,
    memberId: member._id,
    role: member.role,
    rtkParticipantId: member.rtkParticipantId ?? null,
    name: user?.name ?? "Guest",
    imageUrl: user?.imageUrl ?? undefined,
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
) => ctx.db.patch("meetingMembers", memberId, { rtkParticipantId });

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

export const findSessionByNumber = (ctx: QueryCtx, meetingId: Id<"meetings">, number: number) =>
  ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting_and_number", (q) => q.eq("meetingId", meetingId).eq("number", number))
    .unique();

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
    (await ctx.db.get(
      "meetingSessions",
      await ctx.db.insert("meetingSessions", {
        meetingId: meeting._id,
        orgId: meeting.orgId,
        number: await nextSessionNumber(ctx, meeting._id),
        rtkSessionId,
        startedAt: toMillis(event.meeting?.startedAt, now),
        attendeeIds: [],
      }),
    ))!;
  const attendee = event.participant?.customParticipantId;
  const patch: Partial<Doc<"meetingSessions">> = {};
  if (attendee && !session.attendeeIds.includes(attendee)) {
    patch.attendeeIds = [...session.attendeeIds, attendee].slice(0, 1000);
  }
  const peers = session.presentPeers ?? [];
  const peerId = event.participant?.peerId ?? attendee;
  if (attendee && peerId && event.event === "meeting.participantJoined") {
    if (!peers.some((peer) => peer.peerId === peerId)) {
      patch.presentPeers = [...peers, { peerId, memberId: attendee }].slice(0, 1000);
    }
  }
  if (peerId && event.event === "meeting.participantLeft") {
    patch.presentPeers = peers.filter((peer) => peer.peerId !== peerId);
  }
  if (!session.orgId) patch.orgId = meeting.orgId;
  if (event.event === "meeting.ended") {
    patch.endedAt = toMillis(event.meeting?.endedAt, now);
    patch.presentPeers = [];
    await clearStrokes(ctx, meeting._id);
  }
  if (event.summary) patch.summary = event.summary.slice(0, 20_000);
  if (event.transcriptDownloadUrl) patch.transcriptUrl = event.transcriptDownloadUrl;
  if (event.transcriptId) patch.transcriptId = event.transcriptId;
  if (event.recording?.status === "UPLOADED") {
    if (event.recording.downloadUrl) patch.recordingUrl = event.recording.downloadUrl;
    if (event.recordingKey) patch.recordingKey = event.recordingKey;
    if (event.recording.recordingDuration) {
      patch.recordingSeconds = event.recording.recordingDuration;
    }
  }
  if (Object.keys(patch).length) await ctx.db.patch("meetingSessions", session._id, patch);
  if (event.summary && !session.summary) {
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

export const requireSessionAccess = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  sessionId: Id<"meetingSessions">,
) => {
  const session = await ctx.db.get("meetingSessions", sessionId);
  if (!session) throw new ConvexError("This recap doesn't exist");
  const { meeting } = await requireMeetingMember(ctx, session.meetingId, userId);
  return { meeting, session };
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
    summary: session.summary ?? null,
    transcriptUrl: session.transcriptId ? await ctx.storage.getUrl(session.transcriptId) : null,
    hasRecording: Boolean(session.recordingKey || session.recordingUrl),
    recordingSeconds: session.recordingSeconds ?? null,
  };
};
