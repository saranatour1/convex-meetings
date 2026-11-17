import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import { DateTime } from "luxon";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { enforceRateLimit } from "../lib/rateLimits";
import { lastOccurrenceEnd, occurrencesBetween, ruleEndingAt } from "../lib/recurrence";
import { parseOrThrow } from "../lib/validate";
import { zMeeting } from "../tables/meetings";
import { zMeetingMember } from "../tables/meetingMembers";
import { zMeetingTime } from "../tables/meetingTimes";
import { clearStrokes } from "./annotations";
import { canControlCall } from "./calls";
import { requireMeetingMember } from "./meetingAccess";
import { findRoom, isPublicRoom } from "./roomAccess";
import { findMember } from "./members";
import { queueMeetingEmails } from "./meetingEmails";
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
  quiet?: boolean;
  access?: Doc<"meetings">["access"];
  slowModeSeconds?: number;
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
  await enforceRateLimit(ctx, "meeting", meeting.userId);
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
      record: meeting.access === "public" ? undefined : autoRecord,
      protected: meeting.protected || undefined,
      access: meeting.access,
      slowModeSeconds: meeting.slowModeSeconds || undefined,
    }),
  );
  const rrule = meeting.rrule || undefined;
  await ctx.db.insert(
    "meetingTimes",
    parseOrThrow(zMeetingTime, {
      ...time,
      meetingId,
      orgId: meeting.orgId,
      rrule,
      repeatUntil: lastOccurrenceEnd(rrule, time),
    }),
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
  if (meeting.quiet) return { meetingId, code };
  await notify(ctx, inviteeIds, {
    kind: "meetingInvite",
    title: meeting.title,
    meetingCode: code,
    actorId: meeting.userId,
  });
  const [saved, savedTime] = await Promise.all([
    ctx.db.get("meetings", meetingId),
    timeOf(ctx, meetingId),
  ]);
  if (saved && savedTime) await queueMeetingEmails(ctx, "REQUEST", saved, savedTime, inviteeIds);
  return { meetingId, code };
};

export const startInstantMeeting = async (
  ctx: MutationCtx,
  meeting: Pick<
    NewMeeting,
    "orgId" | "userId" | "title" | "timeZone" | "inviteeIds" | "canManageMeetings" | "quiet"
  >,
  overrides: Partial<Pick<NewMeeting, "kind" | "access" | "slowModeSeconds">> = {},
) => {
  const settings = await getSettings(ctx, meeting.userId);
  const startsAt = Math.floor(Date.now() / 60_000) * 60_000;
  const local = DateTime.fromMillis(startsAt, { zone: meeting.timeZone });
  const untilMidnight = Math.floor(local.endOf("day").diff(local, "minutes").minutes);
  return createMeeting(ctx, {
    ...meeting,
    kind: settings.defaultKind,
    recap: settings.defaultRecap,
    startsAt,
    minutes: Math.max(5, Math.min(60, untilMidnight)),
    timeZone: untilMidnight < 5 ? "UTC" : meeting.timeZone,
    ...overrides,
  });
};

const timeOf = (ctx: QueryCtx, meetingId: Id<"meetings">) =>
  ctx.db
    .query("meetingTimes")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .first();

const endedTime = (time: Doc<"meetingTimes">, now: number) => {
  if (time.rrule) {
    const rrule = ruleEndingAt(time.rrule, now);
    return { rrule, repeatUntil: lastOccurrenceEnd(rrule, time) };
  }
  const minutes = Math.max(5, Math.ceil((now - time.startsAt) / 60_000));
  if (now <= time.startsAt || time.startsAt + minutes * 60_000 >= time.endsAt) return null;
  const trimmed = meetingTime(time.startsAt, minutes, time.timeZone);
  return { ...trimmed, repeatUntil: trimmed.endsAt };
};

export const endEmptyMeeting = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const meeting = await ctx.db.get("meetings", meetingId);
  if (!meeting || meeting.endedAt || isPublicRoom(meeting)) return null;
  const someone = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
    .first();
  if (someone) return null;
  const now = Date.now();
  await ctx.db.patch("meetings", meetingId, parseOrThrow(zMeeting, { ...meeting, endedAt: now }));
  const time = await timeOf(ctx, meetingId);
  const changes = time && endedTime(time, now);
  if (time && changes) {
    await ctx.db.patch(
      "meetingTimes",
      time._id,
      parseOrThrow(zMeetingTime, { ...time, ...changes }),
    );
  }
  return meeting.rtkMeetingId ?? null;
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
      if (!meeting || !time || isPublicRoom(meeting)) return null;
      return {
        _id: meeting._id,
        code: meeting.code,
        title: meeting.title,
        kind: meeting.kind,
        startsAt: time.startsAt,
        endsAt: time.endsAt,
        timeZone: time.timeZone,
        rrule: time.rrule ?? null,
        endedAt: meeting.endedAt ?? null,
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
  const devicesInCall = (
    await ctx.db
      .query("callPeers")
      .withIndex("by_meeting_and_member", (q) =>
        q.eq("meetingId", meetingId).eq("memberId", member._id),
      )
      .take(20)
  ).length;
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
  const open = isPublicRoom(meeting);
  const listed = open && !canControl ? members.filter((m) => m.role === "host") : members;
  const people = await Promise.all(
    listed.map(async (m) => {
      const user = await getViewer(ctx, m.userId);
      return {
        _id: m._id,
        name: user?.name ?? "Anonymous",
        email: isGuest || open ? null : (user?.email ?? null),
        imageUrl: open ? null : (user?.imageUrl ?? null),
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
    protected: open || (meeting.protected ?? false),
    access: meeting.access ?? "invited",
    inviters: meeting.inviters ?? "hosts",
    slowModeSeconds: meeting.slowModeSeconds ?? 0,
    waitingRoom: open && ((await findRoom(ctx, meetingId))?.waitingRoom ?? false),
    endedAt: meeting.endedAt ?? null,
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
      summary: open && s.summaryCheck !== "ok" ? null : (s.summary ?? null),
      hasTranscript: Boolean(s.transcriptId || s.transcriptUrl),
      hasRecording: Boolean(s.recordingKey || s.recordingUrl),
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
      | "meetingTimes"
      | "meetingMembers"
      | "messages"
      | "messageReactions"
      | "meetingSessions"
      | "annotationSnapshots"
      | "callPeers"
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
  const [time, invited] = await Promise.all([
    timeOf(ctx, meetingId),
    ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId))
      .take(1000),
  ]);
  if (time && !meeting.endedAt && time.repeatUntil > Date.now()) {
    await queueMeetingEmails(
      ctx,
      "CANCEL",
      meeting,
      time,
      invited.filter((m) => m.userId !== userId && m.response !== "declined").map((m) => m.userId),
    );
  }
  const byMeeting = (table: "meetingTimes" | "messages" | "messageReactions" | "meetingSessions") =>
    ctx.db
      .query(table)
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .take(1000);
  await deleteAll(ctx, await byMeeting("meetingTimes"));
  await deleteAll(ctx, await byMeeting("messages"));
  await deleteAll(ctx, await byMeeting("messageReactions"));
  await deleteAll(ctx, await byMeeting("meetingSessions"));
  await deleteAll(
    ctx,
    await ctx.db
      .query("callPeers")
      .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
      .take(1000),
  );
  for (const ring of await ctx.db
    .query("rings")
    .withIndex("by_meeting_and_caller", (q) => q.eq("meetingId", meetingId))
    .take(1000)) {
    await ctx.db.delete("rings", ring._id);
  }
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
  const room = await findRoom(ctx, meetingId);
  if (room) await ctx.db.delete("rooms", room._id);
  await ctx.db.delete("meetings", meetingId);
  return meeting.rtkMeetingId ?? null;
};

export const busyForOrg = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  from: number,
  to: number,
) => {
  const [members, times] = await Promise.all([
    ctx.db
      .query("members")
      .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS_READ),
    ctx.db
      .query("meetingTimes")
      .withIndex("by_org_and_repeat_until", (q) => q.eq("orgId", orgId).gte("repeatUntil", from))
      .take(1000),
  ]);
  const busy = new Map<Id<"users">, { start: number; end: number }[]>(
    members.map((member) => [member.userId, []]),
  );
  await Promise.all(
    times
      .filter((time) => time.startsAt < to)
      .map(async (time) => {
        const occurrences = occurrencesBetween(time.rrule, time, from, to, time.repeatUntil);
        if (occurrences.length === 0) return;
        const invited = await ctx.db
          .query("meetingMembers")
          .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", time.meetingId))
          .take(MAX_MEMBERS_READ);
        for (const member of invited) {
          if (member.response === "declined") continue;
          busy.get(member.userId)?.push(...occurrences);
        }
      }),
  );
  return Object.fromEntries(busy);
};
