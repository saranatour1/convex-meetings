import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zAgentPresence } from "../tables/agentPresence";
import { openSession, requireMeetingMember } from "./meetingAccess";

export const AGENT_GRACE_MS = 2 * 60_000;

const presenceOf = (ctx: QueryCtx, meetingId: Id<"meetings">, memberId: Id<"meetingMembers">) =>
  ctx.db
    .query("agentPresence")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId),
    )
    .unique();

export const attendAsAgent = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { member } = await requireMeetingMember(ctx, meetingId, userId);
  if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
  if (!(await ctx.db.get("users", userId))?.agent) {
    throw new ConvexError("Only AI agents follow a call this way");
  }
  const session = await openSession(ctx, meetingId);
  if (!session) return { live: false };
  const seenAt = Date.now();
  const presence = parseOrThrow(zAgentPresence, {
    meetingId,
    sessionId: session._id,
    memberId: member._id,
    seenAt,
  });
  const existing = await presenceOf(ctx, meetingId, member._id);
  const presenceId = existing?._id ?? (await ctx.db.insert("agentPresence", presence));
  if (existing) await ctx.db.patch("agentPresence", existing._id, presence);
  await ctx.scheduler.runAfter(AGENT_GRACE_MS, internal.internal.agents.expire, {
    presenceId,
    seenAt,
  });
  return { live: true };
};

export const leaveAsAgent = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
) => {
  const { member } = await requireMeetingMember(ctx, meetingId, userId);
  await forgetAgent(ctx, meetingId, member._id);
};

export const expirePresence = async (
  ctx: MutationCtx,
  presenceId: Id<"agentPresence">,
  seenAt: number,
) => {
  const presence = await ctx.db.get("agentPresence", presenceId);
  if (presence?.seenAt === seenAt) await ctx.db.delete("agentPresence", presenceId);
};

export const forgetAgent = async (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  memberId: Id<"meetingMembers">,
) => {
  const presence = await presenceOf(ctx, meetingId, memberId);
  if (presence) await ctx.db.delete("agentPresence", presence._id);
};

export const forgetSessionAgents = async (ctx: MutationCtx, sessionId: Id<"meetingSessions">) => {
  const rows = await ctx.db
    .query("agentPresence")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .take(1000);
  for (const row of rows) await ctx.db.delete("agentPresence", row._id);
};

export const forgetMeetingAgents = async (ctx: MutationCtx, meetingId: Id<"meetings">) => {
  const rows = await ctx.db
    .query("agentPresence")
    .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
    .take(1000);
  for (const row of rows) await ctx.db.delete("agentPresence", row._id);
};

export const agentsInCall = async (ctx: QueryCtx, meetingId: Id<"meetings">) =>
  new Set(
    (
      await ctx.db
        .query("agentPresence")
        .withIndex("by_meeting_and_member", (q) => q.eq("meetingId", meetingId))
        .take(1000)
    ).map((row) => row.memberId),
  );
