import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zMessageReaction } from "../tables/messageReactions";
import { zMessage } from "../tables/messages";
import { requireMeetingMember, requireSessionAccess } from "./meetingAccess";
import { createViewerLoader } from "./users";

const REACTIONS_READ = 200;
const REACTOR_NAMES = 10;

const createMemberLoader = (ctx: QueryCtx) => {
  const cache = new Map<Id<"meetingMembers">, Promise<Doc<"meetingMembers"> | null>>();
  return (memberId: Id<"meetingMembers">) => {
    const cached = cache.get(memberId);
    if (cached) return cached;
    const pending = ctx.db.get("meetingMembers", memberId);
    cache.set(memberId, pending);
    return pending;
  };
};

type ChatLoaders = {
  member: ReturnType<typeof createMemberLoader>;
  viewer: ReturnType<typeof createViewerLoader>;
};

const createChatLoaders = (ctx: QueryCtx): ChatLoaders => ({
  member: createMemberLoader(ctx),
  viewer: createViewerLoader(ctx),
});

const reactionsOf = async (
  ctx: QueryCtx,
  loaders: ChatLoaders,
  messageId: Id<"messages">,
  userId: Id<"users">,
) => {
  const rows = await ctx.db
    .query("messageReactions")
    .withIndex("by_message_and_member", (q) => q.eq("messageId", messageId))
    .take(REACTIONS_READ);
  const members = await Promise.all(rows.map((row) => loaders.member(row.memberId)));
  const namedPerEmoji = new Map<string, number>();
  const names = await Promise.all(
    rows.map(async (row, index) => {
      const member = members[index];
      const named = namedPerEmoji.get(row.emoji) ?? 0;
      if (!member || named >= REACTOR_NAMES) return null;
      namedPerEmoji.set(row.emoji, named + 1);
      return (await loaders.viewer(member.userId))?.name ?? "Someone";
    }),
  );
  const groups = new Map<
    string,
    { emoji: string; count: number; mine: boolean; names: string[] }
  >();
  for (const [index, row] of rows.entries()) {
    const group = groups.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false, names: [] };
    group.count += 1;
    if (members[index]?.userId === userId) group.mine = true;
    const name = names[index];
    if (name !== null) group.names.push(name);
    groups.set(row.emoji, group);
  }
  return [...groups.values()];
};

const describeMessage = async (
  ctx: QueryCtx,
  loaders: ChatLoaders,
  message: Doc<"messages">,
  userId: Id<"users">,
) => {
  const author = await loaders.member(message.meetingMemberId);
  const user = author && (await loaders.viewer(author.userId));
  return {
    reactions: await reactionsOf(ctx, loaders, message._id, userId),
    _id: message._id,
    _creationTime: message._creationTime,
    body: message.body,
    authorId: message.meetingMemberId,
    authorName: user?.name ?? "Someone",
    authorImageUrl: user?.imageUrl ?? null,
    mine: author?.userId === userId,
  };
};

export const listMessages = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  paginationOpts: PaginationOptions,
  userId: Id<"users">,
) => {
  const result = await ctx.db
    .query("messages")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .paginate(paginationOpts);
  const loaders = createChatLoaders(ctx);
  return {
    ...result,
    page: await Promise.all(result.page.map((m) => describeMessage(ctx, loaders, m, userId))),
  };
};

export const listSessionMessages = async (
  ctx: QueryCtx,
  userId: Id<"users">,
  sessionId: Id<"meetingSessions">,
  paginationOpts: PaginationOptions,
) => {
  const { session } = await requireSessionAccess(ctx, userId, sessionId);
  const result = await ctx.db
    .query("messages")
    .withIndex("by_meeting", (q) => {
      const range = q.eq("meetingId", session.meetingId).gte("_creationTime", session.startedAt);
      return session.endedAt === undefined ? range : range.lte("_creationTime", session.endedAt);
    })
    .paginate(paginationOpts);
  const loaders = createChatLoaders(ctx);
  return {
    ...result,
    page: await Promise.all(result.page.map((m) => describeMessage(ctx, loaders, m, userId))),
  };
};

export const toggleReaction = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  messageId: Id<"messages">,
  emoji: (typeof zMessageReaction._output)["emoji"],
) => {
  const message = await ctx.db.get("messages", messageId);
  if (!message) throw new ConvexError("This message was deleted");
  const { member } = await requireMeetingMember(ctx, message.meetingId, userId);
  if (member.removedAt) throw new ConvexError("The host removed you from this meeting");
  const mine = await ctx.db
    .query("messageReactions")
    .withIndex("by_message_and_member", (q) =>
      q.eq("messageId", messageId).eq("memberId", member._id),
    )
    .take(REACTIONS_READ);
  const existing = mine.find((row) => row.emoji === emoji);
  if (existing) {
    await ctx.db.delete("messageReactions", existing._id);
    return false;
  }
  await ctx.db.insert(
    "messageReactions",
    parseOrThrow(zMessageReaction, {
      messageId,
      meetingId: message.meetingId,
      memberId: member._id,
      emoji,
    }),
  );
  return true;
};

export const sendMessage = (
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  meetingMemberId: Id<"meetingMembers">,
  body: string,
) => ctx.db.insert("messages", parseOrThrow(zMessage, { meetingId, meetingMemberId, body }));
