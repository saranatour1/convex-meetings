import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { waitingRoomCounts, type WaitingRoomCount } from "../lib/aggregates";
import { parseOrThrow } from "../lib/validate";
import { zJoinRequest } from "../tables/joinRequests";
import { zMeetingMember } from "../tables/meetingMembers";
import { canControlCall, requireCallControl } from "./calls";
import { enterAsGuest, findMeetingMember, grantGuestPass, insertGuestUser } from "./guests";
import { GUEST_PASS_MS, issueToken } from "./invites";
import { findMeetingByCode } from "./meetings";
import { queueNameCheck } from "./moderationQueue";
import { notify } from "./notifications";
import {
  hasWaitingRoom,
  isPublicRoom,
  requireDeviceNotBanned,
  requireNotBanned,
} from "./roomAccess";
import { createViewerLoader } from "./users";

const MAX_HOSTS_READ = 200;

export const findJoinRequest = (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) =>
  ctx.db
    .query("joinRequests")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
    .unique();

const tally = (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  count: WaitingRoomCount,
  userId: Id<"users">,
) =>
  waitingRoomCounts.insertIfDoesNotExist(ctx, {
    namespace: [meetingId, count],
    key: null,
    id: userId,
  });

const untally = (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  count: WaitingRoomCount,
  userId: Id<"users">,
) =>
  waitingRoomCounts.deleteIfExists(ctx, { namespace: [meetingId, count], key: null, id: userId });

export const waitingRoomStats = async (ctx: QueryCtx, meetingId: Id<"meetings">) => {
  const [waiting, joined, admitted] = await Promise.all([
    waitingRoomCounts.count(ctx, { namespace: [meetingId, "waiting"] }),
    waitingRoomCounts.count(ctx, { namespace: [meetingId, "joined"] }),
    waitingRoomCounts.count(ctx, { namespace: [meetingId, "admitted"] }),
  ]);
  return { waiting, joined, admitted };
};

const waitsAtDoor = async (ctx: QueryCtx, meeting: Doc<"meetings">) =>
  (meeting.access ?? "invited") === "ask" || (await hasWaitingRoom(ctx, meeting));

export const canAsk = async (ctx: QueryCtx, meeting: Doc<"meetings">) =>
  !meeting.endedAt && (await waitsAtDoor(ctx, meeting));

const requireAskable = async (ctx: QueryCtx, meeting: Doc<"meetings"> | null) => {
  if (!meeting || !(await waitsAtDoor(ctx, meeting))) {
    throw new ConvexError("Only invited people can join this meeting");
  }
  if (meeting.endedAt) {
    throw new ConvexError(isPublicRoom(meeting) ? "This room is closed" : "This meeting has ended");
  }
  return meeting;
};

const waitingRequests = (ctx: QueryCtx, meetingId: Id<"meetings">, limit: number) =>
  ctx.db
    .query("joinRequests")
    .withIndex("by_meeting_and_status", (q) => q.eq("meetingId", meetingId).eq("status", "waiting"))
    .take(limit);

const openRequest = async (
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  userId: Id<"users">,
  guest: { tokenId?: Id<"tokens">; deviceId?: string } = {},
) => {
  const alreadyWaiting = (await waitingRequests(ctx, meeting._id, 1)).length > 0;
  await ctx.db.insert(
    "joinRequests",
    parseOrThrow(zJoinRequest, { ...guest, meetingId: meeting._id, userId, status: "waiting" }),
  );
  await tally(ctx, meeting._id, "waiting", userId);
  await tally(ctx, meeting._id, "joined", userId);
  if (isPublicRoom(meeting) && alreadyWaiting) return;
  const hosts = (
    await ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meeting._id))
      .take(MAX_HOSTS_READ)
  ).filter((member) => member.role === "host");
  await notify(
    ctx,
    hosts.map((host) => host.userId),
    { kind: "joinRequest", title: meeting.title, meetingCode: meeting.code, actorId: userId },
  );
};

export const askAsMember = async (ctx: MutationCtx, userId: Id<"users">, code: string) => {
  const meeting = await requireAskable(ctx, await findMeetingByCode(ctx, code));
  if (isPublicRoom(meeting)) await requireNotBanned(ctx, meeting.orgId, userId);
  if (await findMeetingMember(ctx, meeting._id, userId)) return;
  const request = await findJoinRequest(ctx, meeting._id, userId);
  if (request?.status === "waiting") return;
  if (request) await ctx.db.delete("joinRequests", request._id);
  await openRequest(ctx, meeting, userId);
};

export const enterOrAskAsGuest = async (
  ctx: MutationCtx,
  code: string,
  name: string,
  deviceId?: string,
) => {
  const meeting = await findMeetingByCode(ctx, code);
  if (!meeting || !(await waitsAtDoor(ctx, meeting))) {
    return enterAsGuest(ctx, code, name, deviceId);
  }
  const askable = await requireAskable(ctx, meeting);
  const room = isPublicRoom(askable);
  if (room && !deviceId) throw new ConvexError("Reload the page to join this room");
  if (room && deviceId) await requireDeviceNotBanned(ctx, askable.orgId, deviceId);
  const userId = await insertGuestUser(ctx, { name });
  const { secret, tokenId } = await issueToken(ctx, GUEST_PASS_MS);
  await openRequest(ctx, askable, userId, { tokenId, deviceId: room ? deviceId : undefined });
  return secret;
};

const requireRequestControl = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const request = await ctx.db.get("joinRequests", requestId);
  if (!request) throw new ConvexError("They're no longer waiting");
  const { meeting } = await requireCallControl(ctx, request.meetingId, userId);
  return { request, meeting };
};

export const admitRequest = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const { request, meeting } = await requireRequestControl(ctx, userId, requestId);
  const { meetingId, tokenId } = request;
  if (tokenId) {
    await grantGuestPass(ctx, {
      meetingId,
      userId: request.userId,
      tokenId,
      deviceId: request.deviceId,
    });
  } else if (!(await findMeetingMember(ctx, meetingId, request.userId))) {
    await ctx.db.insert(
      "meetingMembers",
      parseOrThrow(zMeetingMember, {
        meetingId,
        userId: request.userId,
        role: "participant",
        response: "accepted",
      }),
    );
  }
  await ctx.db.delete("joinRequests", request._id);
  await untally(ctx, meetingId, "waiting", request.userId);
  await tally(ctx, meetingId, "admitted", request.userId);
  const member =
    tokenId && isPublicRoom(meeting)
      ? await findMeetingMember(ctx, meetingId, request.userId)
      : null;
  if (member) await queueNameCheck(ctx, member._id);
};

export const denyRequest = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const { request } = await requireRequestControl(ctx, userId, requestId);
  await ctx.db.patch("joinRequests", request._id, { status: "denied" });
  await untally(ctx, request.meetingId, "waiting", request.userId);
};

export const listWaiting = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  paginationOpts: PaginationOptions,
) => {
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", meetingId),
    findMeetingMember(ctx, meetingId, userId),
  ]);
  if (!meeting || !member || !(await canControlCall(ctx, meeting, member))) {
    return { page: [], isDone: true, continueCursor: "" };
  }
  const result = await ctx.db
    .query("joinRequests")
    .withIndex("by_meeting_and_status", (q) => q.eq("meetingId", meetingId).eq("status", "waiting"))
    .paginate(paginationOpts);
  const viewer = createViewerLoader(ctx);
  const page = await Promise.all(
    result.page.map(async (request) => {
      const user = await viewer(request.userId);
      return {
        _id: request._id,
        name: user?.name ?? "Someone",
        imageUrl: user?.imageUrl ?? null,
        isGuest: user?.method === "guest",
      };
    }),
  );
  return { ...result, page };
};

export const deleteJoinRequests = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const requests = await ctx.db
    .query("joinRequests")
    .withIndex("by_meeting_and_status", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const request of requests) {
    if (request.tokenId) {
      await ctx.db.delete("tokens", request.tokenId);
      await ctx.db.delete("users", request.userId);
    }
    await ctx.db.delete("joinRequests", request._id);
  }
  if ((await waitingRoomCounts.count(ctx, { namespace: [meetingId, "joined"] })) === 0) return;
  for (const count of ["waiting", "joined", "admitted"] as const) {
    await waitingRoomCounts.clear(ctx, { namespace: [meetingId, count] });
  }
};
