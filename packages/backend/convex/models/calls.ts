import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { audit } from "./audit";
import { findMember } from "./members";
import { grantedPermissions } from "./roles";
import { getViewer } from "./users";

const LIVE_SESSIONS_READ = 50;

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

const kickLater = (ctx: MutationCtx, rtkMeetingId: string | undefined, memberIds: string[]) =>
  rtkMeetingId && memberIds.length
    ? ctx.scheduler.runAfter(0, internal.internal.realtime.kick, { rtkMeetingId, memberIds })
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
  await kickLater(ctx, meeting.rtkMeetingId, [target._id]);
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
      const meeting = await ctx.db.get("meetings", session.meetingId);
      const present = session.presentIds ?? [];
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
    if (session.presentIds?.includes(member._id)) {
      await kickLater(ctx, meeting.rtkMeetingId, [member._id]);
    }
  }
};
