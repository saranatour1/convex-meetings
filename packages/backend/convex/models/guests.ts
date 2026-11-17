import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { emailWorkpool } from "../lib/workpools";
import { spendEmail } from "./usage";
import { zMeetingGuest } from "../tables/meetingGuests";
import { zMeetingMember } from "../tables/meetingMembers";
import { zUser } from "../tables/users";
import { canControlCall } from "./calls";
import { findLiveToken, issueToken, normalizeEmail } from "./invites";
import { findMeetingByCode } from "./meetings";
import { findMember } from "./members";
import { queueMeetingEmails } from "./meetingEmails";
import { queueNameCheck } from "./moderationQueue";
import { isPublicRoom, requireDeviceNotBanned, requireNotBanned } from "./roomAccess";
import { notify } from "./notifications";

export const GUEST_PASS_MS = 30 * 24 * 60 * 60 * 1000;
const SECRET = /^[0-9a-f]{64}$/;

const findGuest = async (ctx: QueryCtx, secret: string) => {
  if (!SECRET.test(secret)) return null;
  const token = await findLiveToken(ctx, secret);
  if (!token) return null;
  return ctx.db
    .query("meetingGuests")
    .withIndex("by_token", (q) => q.eq("tokenId", token._id))
    .unique();
};

export const guestUserId = async (ctx: QueryCtx, secret: string) => {
  const guest = await findGuest(ctx, secret);
  if (!guest) throw new ConvexError("This guest link has expired. Ask the host for a new one.");
  return guest.userId;
};

export const findMeetingMember = (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) =>
  ctx.db
    .query("meetingMembers")
    .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
    .unique();

export const insertGuestUser = (ctx: MutationCtx, guest: { name: string; email?: string }) =>
  ctx.db.insert(
    "users",
    parseOrThrow(zUser, {
      name: guest.name,
      email: guest.email,
      method: "guest",
      isVerified: false,
    }),
  );

export const grantGuestPass = async (
  ctx: MutationCtx,
  guest: {
    meetingId: Id<"meetings">;
    userId: Id<"users">;
    tokenId: Id<"tokens">;
    invitedBy?: Id<"users">;
    deviceId?: string;
  },
) => {
  await ctx.db.insert(
    "meetingMembers",
    parseOrThrow(zMeetingMember, {
      meetingId: guest.meetingId,
      userId: guest.userId,
      role: "participant",
      response: guest.invitedBy ? "pending" : "accepted",
    }),
  );
  return ctx.db.insert("meetingGuests", parseOrThrow(zMeetingGuest, guest));
};

const createGuest = async (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  guest: { name: string; email?: string; invitedBy?: Id<"users">; deviceId?: string },
) => {
  const userId = await insertGuestUser(ctx, { name: guest.name, email: guest.email });
  const { secret, tokenId } = await issueToken(ctx, GUEST_PASS_MS);
  const guestId = await grantGuestPass(ctx, {
    meetingId,
    userId,
    tokenId,
    invitedBy: guest.invitedBy,
    deviceId: guest.deviceId,
  });
  return { secret, guestId, userId };
};

export const previewMeeting = async (ctx: QueryCtx, code: string) => {
  const meeting = await findMeetingByCode(ctx, code);
  if (!meeting) return null;
  const access = meeting.access ?? "invited";
  if (access === "invited") return { access, title: null, kind: meeting.kind };
  return { access, title: meeting.title, kind: meeting.kind };
};

export const previewGuestPass = async (ctx: QueryCtx, secret: string) => {
  if (!SECRET.test(secret)) return null;
  const token = await findLiveToken(ctx, secret);
  if (!token) return null;
  const holder =
    (await ctx.db
      .query("meetingGuests")
      .withIndex("by_token", (q) => q.eq("tokenId", token._id))
      .unique()) ??
    (await ctx.db
      .query("joinRequests")
      .withIndex("by_token", (q) => q.eq("tokenId", token._id))
      .unique());
  if (!holder) return null;
  const [meeting, user] = await Promise.all([
    ctx.db.get("meetings", holder.meetingId),
    ctx.db.get("users", holder.userId),
  ]);
  if (!meeting || !user) return null;
  const status = "status" in holder ? (meeting.endedAt ? "ended" : holder.status) : "in";
  return { code: meeting.code, title: meeting.title, name: user.name ?? "", status };
};

const enterRoomAsGuest = async (
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  name: string,
  deviceId: string | undefined,
) => {
  if (meeting.endedAt) throw new ConvexError("This room is closed");
  if (!deviceId) throw new ConvexError("Reload the page to join this room");
  await requireDeviceNotBanned(ctx, meeting.orgId, deviceId);
  const { secret, userId } = await createGuest(ctx, meeting._id, { name, deviceId });
  const member = await findMeetingMember(ctx, meeting._id, userId);
  if (member) await queueNameCheck(ctx, member._id);
  return secret;
};

export const enterAsGuest = async (
  ctx: MutationCtx,
  code: string,
  name: string,
  deviceId?: string,
) => {
  const meeting = await findMeetingByCode(ctx, code);
  if (meeting && isPublicRoom(meeting)) return enterRoomAsGuest(ctx, meeting, name, deviceId);
  if (!meeting || (meeting.access ?? "invited") !== "link") {
    throw new ConvexError("Only invited people can join this meeting");
  }
  const { secret } = await createGuest(ctx, meeting._id, { name });
  return secret;
};

export const renameGuest = async (ctx: MutationCtx, secret: string, name: string) => {
  const guest = await findGuest(ctx, secret);
  if (!guest) throw new ConvexError("This guest link has expired");
  await ctx.db.patch("users", guest.userId, parseOrThrow(zUser.pick({ name: true }), { name }));
  const [member, meeting] = await Promise.all([
    findMeetingMember(ctx, guest.meetingId, guest.userId),
    ctx.db.get("meetings", guest.meetingId),
  ]);
  if (member?.response === "pending") {
    await ctx.db.patch("meetingMembers", member._id, { response: "accepted" });
  }
  if (member && meeting && isPublicRoom(meeting)) await queueNameCheck(ctx, member._id);
};

const isGuest = async (ctx: QueryCtx, userId: Id<"users">) =>
  (await ctx.db.get("users", userId))?.method === "guest";

export const canEnter = async (ctx: QueryCtx, meeting: Doc<"meetings">, userId: Id<"users">) => {
  const access = meeting.access ?? "invited";
  if (access === "invited" || (await isGuest(ctx, userId))) return false;
  if (access === "link" || access === "public") return true;
  return (await findMember(ctx, meeting.orgId, userId)) !== null;
};

export const enterAsMember = async (ctx: MutationCtx, userId: Id<"users">, code: string) => {
  const meeting = await findMeetingByCode(ctx, code);
  if (!meeting) throw new ConvexError("No meeting with that code");
  if (isPublicRoom(meeting)) await requireNotBanned(ctx, meeting.orgId, userId);
  if (await findMeetingMember(ctx, meeting._id, userId)) return meeting._id;
  if (isPublicRoom(meeting) && meeting.endedAt) throw new ConvexError("This room is closed");
  if (!(await canEnter(ctx, meeting, userId))) {
    throw new ConvexError("Only invited people can join this meeting");
  }
  await ctx.db.insert(
    "meetingMembers",
    parseOrThrow(zMeetingMember, {
      meetingId: meeting._id,
      userId,
      role: "participant",
      response: "accepted",
    }),
  );
  return meeting._id;
};

export const requireInviteRights = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
) => {
  const meeting = await ctx.db.get("meetings", meetingId);
  const member = await findMeetingMember(ctx, meetingId, userId);
  if (!meeting || !member) throw new ConvexError("You're not invited to this meeting");
  if (member.removedAt || (await isGuest(ctx, userId))) {
    throw new ConvexError("Guests can't invite people");
  }
  if ((meeting.inviters ?? "hosts") === "hosts" && !(await canControlCall(ctx, meeting, member))) {
    throw new ConvexError("Only the host can invite people to this meeting");
  }
  return meeting;
};

const orgUserByEmail = async (ctx: QueryCtx, orgId: Id<"organizations">, email: string) => {
  const users = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(10);
  for (const user of users) {
    if (user.method !== "guest" && (await findMember(ctx, orgId, user._id))) return user;
  }
  return null;
};

const isGuestInMeeting = async (ctx: QueryCtx, meetingId: Id<"meetings">, email: string) => {
  const users = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(10);
  const memberships = await Promise.all(
    users
      .filter((user) => user.method === "guest")
      .map((user) => findMeetingMember(ctx, meetingId, user._id)),
  );
  return memberships.some((membership) => membership !== null);
};

export const inviteToMeeting = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  emails: string[],
) => {
  const meeting = await requireInviteRights(ctx, meetingId, userId);
  const time = await ctx.db
    .query("meetingTimes")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .first();
  const added: string[] = [];
  const guests: string[] = [];
  const skipped: string[] = [];
  for (const email of new Set(emails.map(normalizeEmail))) {
    const member = await orgUserByEmail(ctx, meeting.orgId, email);
    if (member) {
      if (await findMeetingMember(ctx, meetingId, member._id)) {
        skipped.push(email);
        continue;
      }
      await ctx.db.insert(
        "meetingMembers",
        parseOrThrow(zMeetingMember, {
          meetingId,
          userId: member._id,
          role: "participant",
          response: "pending",
        }),
      );
      await notify(ctx, [member._id], {
        kind: "meetingInvite",
        title: meeting.title,
        meetingCode: meeting.code,
        actorId: userId,
      });
      if (time) await queueMeetingEmails(ctx, "REQUEST", meeting, time, [member._id]);
      added.push(email);
      continue;
    }
    if (await isGuestInMeeting(ctx, meetingId, email)) {
      skipped.push(email);
      continue;
    }
    const { secret, guestId } = await createGuest(ctx, meetingId, {
      name: email.split("@")[0] ?? email,
      email,
      invitedBy: userId,
    });
    await spendEmail(ctx);
    await emailWorkpool.enqueueAction(ctx, internal.internal.guests.sendInvite, {
      guestId,
      secret,
    });
    guests.push(email);
  }
  return { added, guests, skipped };
};

export const guestInviteDetails = async (ctx: QueryCtx, guestId: Id<"meetingGuests">) => {
  const guest = await ctx.db.get("meetingGuests", guestId);
  if (!guest?.invitedBy) return null;
  const [meeting, user, inviter] = await Promise.all([
    ctx.db.get("meetings", guest.meetingId),
    ctx.db.get("users", guest.userId),
    ctx.db.get("users", guest.invitedBy),
  ]);
  if (!meeting || !user?.email) return null;
  const time = await ctx.db
    .query("meetingTimes")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
    .first();
  return {
    orgId: meeting.orgId,
    email: user.email,
    title: meeting.title,
    startsAt: time?.startsAt ?? null,
    timeZone: time?.timeZone ?? "UTC",
    inviterName: inviter?.name ?? "Someone",
  };
};

export const recordGuestInviteSend = async (
  ctx: MutationCtx,
  guestId: Id<"meetingGuests">,
  emailError: string | undefined,
) => {
  if (await ctx.db.get("meetingGuests", guestId)) {
    await ctx.db.patch("meetingGuests", guestId, { emailError });
  }
};
