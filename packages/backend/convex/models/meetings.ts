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
import { findMember } from "./members";
import { getViewer } from "./users";

const MAX_INVITEES = 100;
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

export const createMeeting = async (ctx: MutationCtx, meeting: NewMeeting) => {
  const inviteeIds = [...new Set(meeting.inviteeIds)].filter((id) => id !== meeting.userId);
  if (inviteeIds.length > MAX_INVITEES)
    throw new ConvexError(`Invite at most ${MAX_INVITEES} people`);
  for (const userId of inviteeIds) {
    if (!(await findMember(ctx, meeting.orgId, userId))) {
      throw new ConvexError("Only members of this organization can be invited");
    }
  }
  const time = meetingTime(meeting.startsAt, meeting.minutes, meeting.timeZone);
  const meetingId = await ctx.db.insert(
    "meetings",
    parseOrThrow(zMeeting, {
      orgId: meeting.orgId,
      userId: meeting.userId,
      title: meeting.title,
      kind: meeting.kind,
      recap: meeting.recap,
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
  return meetingId;
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
      const [meeting, time] = await Promise.all([
        ctx.db.get("meetings", membership.meetingId),
        timeOf(ctx, membership.meetingId),
      ]);
      if (!meeting || !time) return null;
      return {
        _id: meeting._id,
        title: meeting.title,
        kind: meeting.kind,
        startsAt: time.startsAt,
        endsAt: time.endsAt,
        timeZone: time.timeZone,
        rrule: time.rrule ?? null,
        response: membership.response,
        role: membership.role,
      };
    }),
  );
  return { ...memberships, page: page.filter((m) => m !== null) };
};

export const getMeeting = async (ctx: QueryCtx, userId: Id<"users">, meetingId: Id<"meetings">) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
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
      };
    }),
  );
  return {
    _id: meeting._id,
    orgId: meeting.orgId,
    title: meeting.title,
    kind: meeting.kind,
    recap: meeting.recap,
    time,
    me: { _id: member._id, role: member.role, response: member.response },
    people,
    sessions: sessions.map((s) => ({
      _id: s._id,
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
  const { member } = await requireMeetingMember(ctx, meetingId, userId);
  await ctx.db.patch("meetingMembers", member._id, { response });
};

const deleteAll = async (
  ctx: MutationCtx,
  docs: { _id: Id<"meetingTimes" | "meetingMembers" | "messages" | "meetingSessions"> }[],
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
  await deleteAll(
    ctx,
    await ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId))
      .take(1000),
  );
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

export const listMessages = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("messages")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (message) => {
      const author = await ctx.db.get("meetingMembers", message.meetingMemberId);
      const user = author && (await getViewer(ctx, author.userId));
      return {
        _id: message._id,
        _creationTime: message._creationTime,
        body: message.body,
        authorId: message.meetingMemberId,
        authorName: user?.name ?? "Someone",
      };
    }),
  );
  return { ...result, page };
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
  const user = await getViewer(ctx, userId);
  return {
    title: meeting.title,
    kind: meeting.kind,
    recap: meeting.recap,
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
  participant?: { customParticipantId?: string };
  summaryDownloadUrl?: string;
  transcriptDownloadUrl?: string;
  recording?: { downloadUrl?: string; status?: string };
  summary?: string;
};

const toMillis = (value: string | undefined, fallback: number) =>
  value ? Date.parse(value) || fallback : fallback;

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
  if (event.event === "meeting.ended") patch.endedAt = toMillis(event.meeting?.endedAt, now);
  if (event.summary) patch.summary = event.summary.slice(0, 20_000);
  if (event.transcriptDownloadUrl) patch.transcriptUrl = event.transcriptDownloadUrl;
  if (event.recording?.downloadUrl && event.recording.status === "UPLOADED") {
    patch.recordingUrl = event.recording.downloadUrl;
  }
  if (Object.keys(patch).length) await ctx.db.patch("meetingSessions", session._id, patch);
};
