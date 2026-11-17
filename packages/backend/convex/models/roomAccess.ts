import { ConvexError } from "convex/values";
import { DateTime } from "luxon";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const ROOM_CAPACITY = 50;
const BANS_READ = 20;
const PEERS_READ = 1000;

export const isPublicRoom = (meeting: Pick<Doc<"meetings">, "access">) =>
  meeting.access === "public";

export const findRoom = (ctx: QueryCtx, meetingId: Id<"meetings">) =>
  ctx.db
    .query("rooms")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .unique();

export const hasWaitingRoom = async (ctx: QueryCtx, meeting: Doc<"meetings">) =>
  isPublicRoom(meeting) && (await findRoom(ctx, meeting._id))?.waitingRoom === true;

export const peopleInCall = async (ctx: QueryCtx, meetingId: Id<"meetings">) => {
  const peers = await ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
    .take(PEERS_READ);
  return new Set(peers.map((peer) => peer.memberId));
};

export const syncRoomPeople = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const room = await findRoom(ctx, meetingId);
  if (!room) return;
  const people = (await peopleInCall(ctx, meetingId)).size;
  if (people !== room.people) await ctx.db.patch("rooms", room._id, { people });
};

type Banned = { userId?: Id<"users">; deviceId?: string };

const isActive = (ban: Doc<"bans">, now: number) =>
  !ban.liftedAt && (ban.expiresAt === undefined || ban.expiresAt > now);

export const findBans = async (ctx: QueryCtx, orgId: Id<"organizations">, who: Banned) => {
  const { userId, deviceId } = who;
  const [byUser, byDevice] = await Promise.all([
    userId
      ? ctx.db
          .query("bans")
          .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
          .order("desc")
          .take(BANS_READ)
      : [],
    deviceId
      ? ctx.db
          .query("bans")
          .withIndex("by_org_and_device", (q) => q.eq("orgId", orgId).eq("deviceId", deviceId))
          .order("desc")
          .take(BANS_READ)
      : [],
  ]);
  return [...byUser, ...byDevice];
};

export const findActiveBan = async (ctx: QueryCtx, orgId: Id<"organizations">, who: Banned) => {
  const now = Date.now();
  return (await findBans(ctx, orgId, who)).find((ban) => isActive(ban, now)) ?? null;
};

export const deviceOf = async (ctx: QueryCtx, userId: Id<"users">) =>
  (
    await ctx.db
      .query("meetingGuests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  )?.deviceId;

export const banMessage = (ban: Pick<Doc<"bans">, "expiresAt">) =>
  ban.expiresAt === undefined
    ? "You're banned from this organization's public rooms."
    : `You're banned from this organization's public rooms until ${DateTime.fromMillis(
        ban.expiresAt,
        { zone: "utc" },
      ).toFormat("LLLL d, HH:mm")} UTC.`;

export const requireNotBanned = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
) => {
  const ban = await findActiveBan(ctx, orgId, { userId, deviceId: await deviceOf(ctx, userId) });
  if (ban) throw new ConvexError(banMessage(ban));
};

export const requireDeviceNotBanned = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  deviceId: string,
) => {
  const ban = await findActiveBan(ctx, orgId, { deviceId });
  if (ban) throw new ConvexError(banMessage(ban));
};
