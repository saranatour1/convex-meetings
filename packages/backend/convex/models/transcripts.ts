import { ConvexError } from "convex/values";
import type { PaginationOptions } from "convex/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zTranscriptLine } from "../tables/transcriptLines";
import { openSession, requireMeetingMember } from "./meetingAccess";
import { isPublicRoom } from "./roomAccess";
import { createViewerLoader } from "./users";

const CLEAR_BATCH = 500;

const requireListener = async (ctx: QueryCtx, meetingId: Id<"meetings">, userId: Id<"users">) => {
  const found = await requireMeetingMember(ctx, meetingId, userId);
  if (found.member.removedAt) throw new ConvexError("The host removed you from this meeting");
  return found;
};

export const addTranscriptLine = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  text: string,
) => {
  const { meeting, member } = await requireListener(ctx, meetingId, userId);
  if (isPublicRoom(meeting) || !(await openSession(ctx, meetingId))) return null;
  return ctx.db.insert(
    "transcriptLines",
    parseOrThrow(zTranscriptLine, { meetingId, memberId: member._id, text, at: Date.now() }),
  );
};

export const listLiveTranscript = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  meetingId: Id<"meetings">,
  paginationOpts: PaginationOptions,
) => {
  await requireListener(ctx, meetingId, userId);
  const session = await openSession(ctx, meetingId);
  if (!session) return { page: [], isDone: true, continueCursor: "" };
  const result = await ctx.db
    .query("transcriptLines")
    .withIndex("by_meeting_and_at", (q) =>
      q.eq("meetingId", meetingId).gte("at", session.startedAt),
    )
    .order("desc")
    .paginate(paginationOpts);
  const viewer = createViewerLoader(ctx);
  const page = await Promise.all(
    result.page.map(async (line) => {
      const member = await ctx.db.get("meetingMembers", line.memberId);
      const user = member && (await viewer(member.userId));
      return {
        _id: line._id,
        memberId: line.memberId,
        at: line.at,
        text: line.text,
        name: user?.name ?? "Someone",
      };
    }),
  );
  return { ...result, page };
};

export const clearTranscript = async (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  until: number,
) => {
  const lines = await ctx.db
    .query("transcriptLines")
    .withIndex("by_meeting_and_at", (q) => q.eq("meetingId", meetingId).lte("at", until))
    .take(CLEAR_BATCH);
  for (const line of lines) await ctx.db.delete("transcriptLines", line._id);
  if (lines.length === CLEAR_BATCH) {
    await ctx.scheduler.runAfter(0, internal.internal.realtime.clearTranscript, {
      meetingId,
      until,
    });
  }
};
