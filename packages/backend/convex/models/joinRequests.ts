import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zJoinRequest } from "../tables/joinRequests";
import { zMeetingMember } from "../tables/meetingMembers";
import { canControlCall, requireCallControl } from "./calls";
import {
  GUEST_PASS_MS,
  enterAsGuest,
  findMeetingMember,
  grantGuestPass,
  insertGuestUser,
} from "./guests";
import { issueToken } from "./invites";
import { findMeetingByCode } from "./meetings";
import { notify } from "./notifications";
import { createViewerLoader } from "./users";

const MAX_HOSTS_READ = 200;

export const findJoinRequest = (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) =>
  ctx.db
    .query("joinRequests")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
    .unique();

export const canAsk = (meeting: Doc<"meetings">) =>
  (meeting.access ?? "invited") === "ask" && !meeting.endedAt;

const requireAskable = (meeting: Doc<"meetings"> | null) => {
  if (!meeting || (meeting.access ?? "invited") !== "ask") {
    throw new ConvexError("Only invited people can join this meeting");
  }
  if (meeting.endedAt) throw new ConvexError("This meeting has ended");
  return meeting;
};

const openRequest = async (
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  userId: Id<"users">,
  tokenId?: Id<"tokens">,
) => {
  await ctx.db.insert(
    "joinRequests",
    parseOrThrow(zJoinRequest, { meetingId: meeting._id, userId, status: "waiting", tokenId }),
  );
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
  const meeting = requireAskable(await findMeetingByCode(ctx, code));
  if (await findMeetingMember(ctx, meeting._id, userId)) return;
  const request = await findJoinRequest(ctx, meeting._id, userId);
  if (request?.status === "waiting") return;
  if (request) await ctx.db.delete("joinRequests", request._id);
  await openRequest(ctx, meeting, userId);
};

export const enterOrAskAsGuest = async (ctx: MutationCtx, code: string, name: string) => {
  const meeting = await findMeetingByCode(ctx, code);
  if ((meeting?.access ?? "invited") !== "ask") return enterAsGuest(ctx, code, name);
  const askable = requireAskable(meeting);
  const userId = await insertGuestUser(ctx, { name });
  const { secret, tokenId } = await issueToken(ctx, GUEST_PASS_MS);
  await openRequest(ctx, askable, userId, tokenId);
  return secret;
};

const requireRequestControl = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const request = await ctx.db.get("joinRequests", requestId);
  if (!request) throw new ConvexError("They're no longer waiting");
  await requireCallControl(ctx, request.meetingId, userId);
  return request;
};

export const admitRequest = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const request = await requireRequestControl(ctx, userId, requestId);
  const { meetingId, tokenId } = request;
  if (tokenId) {
    await grantGuestPass(ctx, { meetingId, userId: request.userId, tokenId });
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
};

export const denyRequest = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  requestId: Id<"joinRequests">,
) => {
  const request = await requireRequestControl(ctx, userId, requestId);
  await ctx.db.patch("joinRequests", request._id, { status: "denied" });
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
};
