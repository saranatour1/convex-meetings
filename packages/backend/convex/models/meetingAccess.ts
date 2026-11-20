import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const findMeetingAccess = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users"> | null,
) => {
  if (!userId) return null;
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", meetingId),
    ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
      .unique(),
  ]);
  return meeting && member ? { meeting, member } : null;
};

export const requireMeetingMember = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
) => {
  const found = await findMeetingAccess(ctx, meetingId, userId);
  if (!found) throw new ConvexError("You're not invited to this meeting");
  return found;
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

export const findSessionByNumber = (ctx: QueryCtx, meetingId: Id<"meetings">, number: number) =>
  ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting_and_number", (q) => q.eq("meetingId", meetingId).eq("number", number))
    .unique();

export const openSession = async (ctx: QueryCtx, meetingId: Id<"meetings">) => {
  const last = await ctx.db
    .query("meetingSessions")
    .withIndex("by_meeting_and_number", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .first();
  return last && last.endedAt === undefined ? last : null;
};
