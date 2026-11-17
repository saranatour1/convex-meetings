import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zMeeting } from "../tables/meetings";
import { zRoom } from "../tables/rooms";
import { audit } from "./audit";
import { requireCallControl } from "./calls";
import { findSessionByNumber } from "./meetingAccess";
import { findMeetingByCode, startInstantMeeting } from "./meetings";
import { findRoom, isPublicRoom } from "./roomAccess";

type NewRoom = {
  orgId: Id<"organizations">;
  userId: Id<"users">;
  title: string;
  description: string;
  slowModeSeconds: number;
  timeZone: string;
};

type RoomChanges = { title?: string; description?: string; slowModeSeconds?: number };

export const createRoom = async (ctx: MutationCtx, room: NewRoom) => {
  const { meetingId, code } = await startInstantMeeting(
    ctx,
    {
      orgId: room.orgId,
      userId: room.userId,
      title: room.title,
      timeZone: room.timeZone,
      inviteeIds: [],
      canManageMeetings: true,
      quiet: true,
    },
    { kind: "groupCall", access: "public", slowModeSeconds: room.slowModeSeconds },
  );
  await ctx.db.insert(
    "rooms",
    parseOrThrow(zRoom, {
      meetingId,
      orgId: room.orgId,
      description: room.description,
      people: 0,
    }),
  );
  await audit(ctx, room.orgId, room.userId, "roomCreated", { detail: room.title });
  return { meetingId, code };
};

const requireRoomControl = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting } = await requireCallControl(ctx, meetingId, userId);
  const room = await findRoom(ctx, meetingId);
  if (!room) throw new ConvexError("This isn't a public room");
  return { meeting, room };
};

export const updateRoom = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  changes: RoomChanges,
) => {
  const { meeting, room } = await requireRoomControl(ctx, userId, meetingId);
  await ctx.db.patch(
    "meetings",
    meetingId,
    parseOrThrow(zMeeting, {
      ...meeting,
      title: changes.title ?? meeting.title,
      slowModeSeconds: (changes.slowModeSeconds ?? meeting.slowModeSeconds) || undefined,
    }),
  );
  if (changes.description !== undefined) {
    await ctx.db.patch(
      "rooms",
      room._id,
      parseOrThrow(zRoom, { ...room, description: changes.description }),
    );
  }
};

export const closeRoom = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { meeting, room } = await requireRoomControl(ctx, userId, meetingId);
  if (room.closedAt) return;
  const now = Date.now();
  await ctx.db.patch("meetings", meetingId, parseOrThrow(zMeeting, { ...meeting, endedAt: now }));
  await ctx.db.patch("rooms", room._id, { closedAt: now });
  const { rtkMeetingId } = meeting;
  if (rtkMeetingId) {
    await ctx.scheduler.runAfter(0, internal.internal.realtime.kickAll, { rtkMeetingId });
    await ctx.scheduler.runAfter(0, internal.internal.realtime.deactivate, { rtkMeetingId });
  }
  await audit(ctx, meeting.orgId, userId, "roomClosed", { detail: meeting.title });
};

const describeRoom = async (ctx: QueryCtx, room: Doc<"rooms">) => {
  const [meeting, org] = await Promise.all([
    ctx.db.get("meetings", room.meetingId),
    ctx.db.get("organizations", room.orgId),
  ]);
  if (!meeting) return null;
  return {
    code: meeting.code,
    title: meeting.title,
    description: room.description,
    people: room.people,
    slowModeSeconds: meeting.slowModeSeconds ?? 0,
    host: org?.name ?? "",
  };
};

export const listOpenRooms = async (ctx: QueryCtx, paginationOpts: PaginationOptions) => {
  const result = await ctx.db
    .query("rooms")
    .withIndex("by_closed_and_people", (q) => q.eq("closedAt", undefined))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(result.page.map((room) => describeRoom(ctx, room)));
  return { ...result, page: page.filter((room) => room !== null) };
};

export const listOrgRooms = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("rooms")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (room) => {
      const described = await describeRoom(ctx, room);
      return (
        described && { ...described, meetingId: room.meetingId, closedAt: room.closedAt ?? null }
      );
    }),
  );
  return { ...result, page: page.filter((room) => room !== null) };
};

const findPublicRoom = async (ctx: QueryCtx, code: string) => {
  const meeting = await findMeetingByCode(ctx, code);
  const room = meeting && isPublicRoom(meeting) ? await findRoom(ctx, meeting._id) : null;
  return meeting && room ? { meeting, room } : null;
};

export const previewRoom = async (ctx: QueryCtx, code: string) => {
  const found = await findPublicRoom(ctx, code);
  const described = found && (await describeRoom(ctx, found.room));
  return found && described ? { ...described, closedAt: found.room.closedAt ?? null } : null;
};

const describeSession = (
  meeting: Doc<"meetings">,
  room: Doc<"rooms">,
  session: Doc<"meetingSessions">,
) => ({
  number: session.number,
  title: meeting.title,
  description: room.description,
  startedAt: session.startedAt,
  endedAt: session.endedAt ?? null,
  people: (session.attendance ?? []).length,
  summary: session.summaryCheck === "ok" ? (session.summary ?? null) : null,
});

export const publicRecap = async (ctx: QueryCtx, code: string, number: number) => {
  const found = await findPublicRoom(ctx, code);
  const session = found && (await findSessionByNumber(ctx, found.meeting._id, number));
  return found && session ? describeSession(found.meeting, found.room, session) : null;
};

export const listPublicRecaps = async (
  ctx: QueryCtx,
  code: string,
  paginationOpts: PaginationOptions,
) => {
  const found = await findPublicRoom(ctx, code);
  if (!found) return { page: [], isDone: true, continueCursor: "" };
  const result = await ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting_and_number", (q) => q.eq("meetingId", found.meeting._id))
    .order("desc")
    .paginate(paginationOpts);
  return {
    ...result,
    page: result.page.map((session) => describeSession(found.meeting, found.room, session)),
  };
};
