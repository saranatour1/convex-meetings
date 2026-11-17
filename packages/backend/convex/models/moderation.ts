import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  CORROBORATION_MS,
  EVIDENCE_MS,
  FIRST_BAN_MS,
  REPEAT_BAN_MS,
  STRIKES_TO_BAN,
  STRIKE_WINDOW_MS,
  decideFrame,
  decideMessage,
  decideName,
  penaltyFor,
  type FrameScores,
  type MessageScores,
  type NameScores,
  type Penalty,
} from "../lib/moderation";
import { tryRateLimit } from "../lib/rateLimits";
import { parseOrThrow } from "../lib/validate";
import { zBan } from "../tables/bans";
import { zModerationFlag } from "../tables/moderationFlags";
import { zUser } from "../tables/users";
import { audit } from "./audit";
import { canControlCall, kickLater } from "./calls";
import { requireMeetingMember } from "./meetingAccess";
import { queueFrameCheck, type FrameReport } from "./moderationQueue";
import { notify } from "./notifications";
import { grantedPermissions } from "./roles";
import {
  deviceOf,
  findActiveBan,
  findBans,
  findRoom,
  isPublicRoom,
  peopleInCall,
} from "./roomAccess";
import { createViewerLoader, getViewer } from "./users";

const RECENT_READ = 10;
const RECENT_SHOWN = 5;
const FLAGS_READ = 100;
const ORG_MEMBERS_READ = 200;
const MAX_FRAME_BYTES = 300 * 1024;
export const REPLACEMENT_NAME = "Guest";
export const UNCHECKED = "unchecked";

type Offence = {
  meeting: Doc<"meetings">;
  member: Doc<"meetingMembers">;
  kind: Doc<"moderationFlags">["kind"];
  reason: string;
  penalty: Penalty;
  scores: Record<string, number>;
  body?: string;
  storageId?: Id<"_storage">;
  reporterId?: Id<"meetingMembers">;
};

const nameOfMember = async (ctx: QueryCtx, memberId: Id<"meetingMembers">) => {
  const member = await ctx.db.get("meetingMembers", memberId);
  return (member && (await getViewer(ctx, member.userId))?.name) ?? "Someone";
};

const roomContext = async (ctx: QueryCtx, meeting: Doc<"meetings">) => {
  const room = await findRoom(ctx, meeting._id);
  return room ? { title: meeting.title, description: room.description } : { title: meeting.title };
};

export const messageState = async (ctx: QueryCtx, messageId: Id<"messages">) => {
  const message = await ctx.db.get("messages", messageId);
  if (!message?.pending) return null;
  const [meeting, earlier] = await Promise.all([
    ctx.db.get("meetings", message.meetingId),
    ctx.db
      .query("messages")
      .withIndex("by_meeting", (q) =>
        q.eq("meetingId", message.meetingId).lt("_creationTime", message._creationTime),
      )
      .order("desc")
      .take(RECENT_READ),
  ]);
  if (!meeting) return null;
  const shown = earlier
    .filter((m) => !m.pending)
    .slice(0, RECENT_SHOWN)
    .reverse();
  const recent = await Promise.all(
    shown.map(async (m) => ({
      author: await nameOfMember(ctx, m.meetingMemberId),
      text: m.body,
    })),
  );
  return {
    room: await roomContext(ctx, meeting),
    ...(recent.length ? { recent } : {}),
    message: { author: await nameOfMember(ctx, message.meetingMemberId), text: message.body },
  };
};

export const nameState = async (ctx: QueryCtx, memberId: Id<"meetingMembers">) => {
  const member = await ctx.db.get("meetingMembers", memberId);
  const user = member && (await ctx.db.get("users", member.userId));
  return user?.name ? { name: user.name } : null;
};

export const summaryState = async (ctx: QueryCtx, sessionId: Id<"meetingSessions">) => {
  const session = await ctx.db.get("meetingSessions", sessionId);
  const meeting = session && (await ctx.db.get("meetings", session.meetingId));
  if (!session?.summary || !meeting) return null;
  return {
    room: await roomContext(ctx, meeting),
    message: { author: "Call summary", text: session.summary },
  };
};

export const strikesToday = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
) => {
  const since = Date.now() - STRIKE_WINDOW_MS;
  const flags = await ctx.db
    .query("moderationFlags")
    .withIndex("by_org_and_user", (q) =>
      q.eq("orgId", orgId).eq("userId", userId).gt("_creationTime", since),
    )
    .take(FLAGS_READ);
  return flags.filter((flag) => flag.action === "strike" || flag.action === "kick").length;
};

const banUser = async (
  ctx: MutationCtx,
  meeting: Doc<"meetings">,
  member: Doc<"meetingMembers">,
  ban: { reason: string; flagId?: Id<"moderationFlags">; bannedBy?: Id<"users"> },
) => {
  const deviceId = await deviceOf(ctx, member.userId);
  const earlier = await findBans(ctx, meeting.orgId, { userId: member.userId, deviceId });
  const length = earlier.length ? REPEAT_BAN_MS : FIRST_BAN_MS;
  await ctx.db.insert(
    "bans",
    parseOrThrow(zBan, {
      ...ban,
      orgId: meeting.orgId,
      userId: member.userId,
      deviceId,
      expiresAt: ban.bannedBy ? undefined : Date.now() + length,
    }),
  );
  await kickLater(ctx, meeting.rtkMeetingId, member);
};

const recordOffence = async (ctx: MutationCtx, offence: Offence) => {
  const { meeting, member, penalty, ...evidence } = offence;
  const exempt = await canControlCall(ctx, meeting, member);
  const outcome = penaltyFor(penalty, {
    exempt,
    strikesToday: await strikesToday(ctx, meeting.orgId, member.userId),
  });
  const frame = offence.kind === "frame";
  const action =
    outcome === "none"
      ? frame
        ? ("review" as const)
        : ("removed" as const)
      : outcome === "strike" && frame
        ? ("kick" as const)
        : outcome;
  const flagId = await ctx.db.insert(
    "moderationFlags",
    parseOrThrow(zModerationFlag, {
      ...evidence,
      action,
      orgId: meeting.orgId,
      meetingId: meeting._id,
      userId: member.userId,
      memberId: member._id,
    }),
  );
  if (outcome === "ban") await banUser(ctx, meeting, member, { reason: offence.reason, flagId });
  return { outcome, flagId };
};

export const dropPendingMessage = async (ctx: MutationCtx, messageId: Id<"messages">) => {
  const message = await ctx.db.get("messages", messageId);
  if (!message?.pending) return;
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", message.meetingId),
    ctx.db.get("meetingMembers", message.meetingMemberId),
  ]);
  await ctx.db.delete("messages", messageId);
  if (!meeting || !member) return;
  await ctx.db.insert(
    "moderationFlags",
    parseOrThrow(zModerationFlag, {
      orgId: meeting.orgId,
      meetingId: meeting._id,
      userId: member.userId,
      memberId: member._id,
      kind: "message",
      reason: UNCHECKED,
      action: "removed",
      scores: {},
      body: message.body,
    }),
  );
};

export const applyMessageVerdict = async (
  ctx: MutationCtx,
  messageId: Id<"messages">,
  scores: MessageScores,
) => {
  const message = await ctx.db.get("messages", messageId);
  if (!message?.pending) return;
  const verdict = decideMessage(scores);
  if (verdict.action === "publish") {
    await ctx.db.patch("messages", messageId, { pending: undefined });
    return;
  }
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", message.meetingId),
    ctx.db.get("meetingMembers", message.meetingMemberId),
  ]);
  await ctx.db.delete("messages", messageId);
  if (!meeting || !member) return;
  await recordOffence(ctx, {
    meeting,
    member,
    kind: "message",
    reason: verdict.reason,
    penalty: verdict.penalty,
    scores,
    body: message.body,
  });
};

export const applyNameVerdict = async (
  ctx: MutationCtx,
  memberId: Id<"meetingMembers">,
  name: string,
  scores: NameScores,
) => {
  const reason = decideName(scores);
  const member = reason && (await ctx.db.get("meetingMembers", memberId));
  if (!reason || !member) return;
  const [meeting, user] = await Promise.all([
    ctx.db.get("meetings", member.meetingId),
    ctx.db.get("users", member.userId),
  ]);
  if (!meeting || user?.name !== name) return;
  const guest = user.method === "guest";
  await ctx.db.insert(
    "moderationFlags",
    parseOrThrow(zModerationFlag, {
      orgId: meeting.orgId,
      meetingId: meeting._id,
      userId: user._id,
      memberId,
      kind: "name",
      reason,
      action: guest ? "removed" : "review",
      scores,
      body: name,
    }),
  );
  if (!guest) return;
  await ctx.db.patch(
    "users",
    user._id,
    parseOrThrow(zUser.pick({ name: true }), { name: REPLACEMENT_NAME }),
  );
  await kickLater(ctx, meeting.rtkMeetingId, member);
  await ctx.db.patch("meetingMembers", memberId, { rtkParticipantId: undefined });
};

export const applySummaryVerdict = async (
  ctx: MutationCtx,
  sessionId: Id<"meetingSessions">,
  scores: MessageScores,
) => {
  if (!(await ctx.db.get("meetingSessions", sessionId))) return;
  await ctx.db.patch("meetingSessions", sessionId, {
    summaryCheck: decideMessage(scores).action === "publish" ? "ok" : "hidden",
  });
};

const inCall = (ctx: QueryCtx, meetingId: Id<"meetings">, memberId: Id<"meetingMembers">) =>
  ctx.db
    .query("callPeers")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId),
    )
    .first();

const openWatches = async (
  ctx: QueryCtx,
  meetingId: Id<"meetings">,
  memberId: Id<"meetingMembers">,
) => {
  const since = Date.now() - CORROBORATION_MS;
  const flags = await ctx.db
    .query("moderationFlags")
    .withIndex("by_meeting_and_member", (q) =>
      q.eq("meetingId", meetingId).eq("memberId", memberId).gt("_creationTime", since),
    )
    .take(FLAGS_READ);
  return flags.filter((flag) => flag.action === "watch" && !flag.resolvedAt);
};

const isStorableFrame = async (ctx: QueryCtx, storageId: Id<"_storage">) => {
  const file = await ctx.db.system.get("_storage", storageId);
  return file !== null && file.contentType === "image/jpeg" && file.size <= MAX_FRAME_BYTES;
};

export const submitFrame = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  frame: Omit<FrameReport, "reporterId">,
) => {
  const { meeting, member } = await requireMeetingMember(ctx, frame.meetingId, userId);
  const [reporterHere, targetHere, ban, storable] = await Promise.all([
    inCall(ctx, meeting._id, member._id),
    inCall(ctx, meeting._id, frame.targetMemberId),
    findActiveBan(ctx, meeting.orgId, { userId }),
    isStorableFrame(ctx, frame.storageId),
  ]);
  const allowed =
    isPublicRoom(meeting) &&
    !member.removedAt &&
    !ban &&
    storable &&
    member._id !== frame.targetMemberId &&
    reporterHere !== null &&
    targetHere !== null;
  const second =
    allowed &&
    (await openWatches(ctx, meeting._id, frame.targetMemberId)).some(
      (flag) => flag.reporterId !== member._id,
    );
  const accepted =
    allowed &&
    (await tryRateLimit(ctx, second ? "frameRecheck" : "frameCheck", frame.targetMemberId));
  if (!accepted) {
    await ctx.storage.delete(frame.storageId);
    return false;
  }
  await queueFrameCheck(ctx, { ...frame, reporterId: member._id });
  return true;
};

const notifyManagers = async (ctx: MutationCtx, meeting: Doc<"meetings">) => {
  const members = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", meeting.orgId))
    .take(ORG_MEMBERS_READ);
  const managers = await Promise.all(
    members.map(async (member) =>
      (await grantedPermissions(ctx, member._id)).has("manageMeetings") ? member.userId : null,
    ),
  );
  await notify(
    ctx,
    managers.filter((id) => id !== null),
    { kind: "moderationReview", title: meeting.title, meetingCode: meeting.code },
  );
};

export const applyFrameVerdict = async (
  ctx: MutationCtx,
  frame: FrameReport,
  scores: FrameScores | null,
) => {
  const [meeting, target, reporter] = await Promise.all([
    ctx.db.get("meetings", frame.meetingId),
    ctx.db.get("meetingMembers", frame.targetMemberId),
    ctx.db.get("meetingMembers", frame.reporterId),
  ]);
  if (!scores || !meeting || !target || !reporter) {
    await ctx.storage.delete(frame.storageId);
    return;
  }
  const [watches, present, trustedReporter] = await Promise.all([
    openWatches(ctx, meeting._id, target._id),
    peopleInCall(ctx, meeting._id),
    canControlCall(ctx, meeting, reporter),
  ]);
  const verdict = decideFrame(scores, {
    trustedReporter,
    corroborated: watches.some((flag) => flag.reporterId !== reporter._id),
    othersPresent: [...present].some((id) => id !== target._id && id !== reporter._id),
  });
  if (verdict.action === "clear") {
    await ctx.storage.delete(frame.storageId);
    return;
  }
  const evidence = {
    kind: "frame" as const,
    reason: verdict.reason,
    scores,
    storageId: frame.storageId,
    reporterId: reporter._id,
  };
  const keepFor = (flagId: Id<"moderationFlags">) =>
    ctx.scheduler.runAfter(EVIDENCE_MS, internal.internal.moderation.dropEvidence, { flagId });
  if (verdict.action === "kick") {
    const { outcome, flagId } = await recordOffence(ctx, {
      ...evidence,
      meeting,
      member: target,
      penalty: verdict.penalty,
    });
    if (outcome === "strike") await kickLater(ctx, meeting.rtkMeetingId, target);
    const resolvedAt = Date.now();
    for (const watch of watches) await ctx.db.patch("moderationFlags", watch._id, { resolvedAt });
    await keepFor(flagId);
    return;
  }
  const flagId = await ctx.db.insert(
    "moderationFlags",
    parseOrThrow(zModerationFlag, {
      ...evidence,
      action: verdict.action,
      orgId: meeting.orgId,
      meetingId: meeting._id,
      userId: target.userId,
      memberId: target._id,
    }),
  );
  if (verdict.action === "review") await notifyManagers(ctx, meeting);
  await keepFor(flagId);
};

export const dropEvidence = async (ctx: MutationCtx, flagId: Id<"moderationFlags">) => {
  const flag = await ctx.db.get("moderationFlags", flagId);
  if (!flag?.storageId) return;
  await ctx.storage.delete(flag.storageId);
  await ctx.db.patch("moderationFlags", flagId, { storageId: undefined });
};

export const watchList = async (ctx: QueryCtx, userId: Id<"users">, meetingId: Id<"meetings">) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  if (!isPublicRoom(meeting)) return [];
  const flags = await ctx.db
    .query("moderationFlags")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .order("desc")
    .take(30);
  return flags
    .filter((flag) => flag.action === "watch" && !flag.resolvedAt)
    .filter((flag) => flag.reporterId !== member._id && flag.memberId !== member._id)
    .map((flag) => ({ memberId: flag.memberId, at: flag._creationTime }));
};

export const myStatus = async (ctx: QueryCtx, userId: Id<"users">, meetingId: Id<"meetings">) => {
  const { meeting, member } = await requireMeetingMember(ctx, meetingId, userId);
  const slowModeSeconds = meeting.slowModeSeconds ?? 0;
  if (!isPublicRoom(meeting)) {
    return {
      moderated: false,
      slowModeSeconds,
      strikeLimit: STRIKES_TO_BAN,
      ban: null,
      strikes: 0,
      lastRemoval: null,
    };
  }
  const [ban, strikes, flags] = await Promise.all([
    findActiveBan(ctx, meeting.orgId, { userId, deviceId: await deviceOf(ctx, userId) }),
    strikesToday(ctx, meeting.orgId, userId),
    ctx.db
      .query("moderationFlags")
      .withIndex("by_meeting_and_member", (q) =>
        q.eq("meetingId", meetingId).eq("memberId", member._id),
      )
      .order("desc")
      .take(20),
  ]);
  const since = Date.now() - STRIKE_WINDOW_MS;
  const last = flags.find(
    (flag) => flag.action !== "watch" && flag.action !== "review" && flag._creationTime > since,
  );
  return {
    moderated: true,
    slowModeSeconds,
    strikeLimit: STRIKES_TO_BAN,
    ban: ban ? { reason: ban.reason, expiresAt: ban.expiresAt ?? null } : null,
    strikes,
    lastRemoval: last ? { kind: last.kind, reason: last.reason, at: last._creationTime } : null,
  };
};

export const listFlags = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("moderationFlags")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate(paginationOpts);
  const viewer = createViewerLoader(ctx);
  const page = await Promise.all(
    result.page.map(async (flag) => {
      const [user, meeting] = await Promise.all([
        viewer(flag.userId),
        ctx.db.get("meetings", flag.meetingId),
      ]);
      return {
        _id: flag._id,
        _creationTime: flag._creationTime,
        kind: flag.kind,
        reason: flag.reason,
        action: flag.action,
        scores: flag.scores,
        body: flag.body ?? null,
        imageUrl: flag.storageId ? await ctx.storage.getUrl(flag.storageId) : null,
        userName: user?.name ?? "Someone",
        isGuest: user?.method === "guest",
        roomTitle: meeting?.title ?? null,
        roomCode: meeting?.code ?? null,
        resolved: Boolean(flag.resolvedAt),
      };
    }),
  );
  return { ...result, page };
};

export const listBans = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("bans")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate(paginationOpts);
  const viewer = createViewerLoader(ctx);
  const page = await Promise.all(
    result.page.map(async (ban) => {
      const user = await viewer(ban.userId);
      return {
        _id: ban._id,
        _creationTime: ban._creationTime,
        userName: user?.name ?? "Someone",
        isGuest: user?.method === "guest",
        reason: ban.reason,
        automatic: !ban.bannedBy,
        expiresAt: ban.expiresAt ?? null,
        liftedAt: ban.liftedAt ?? null,
      };
    }),
  );
  return { ...result, page };
};

const requireOrgFlag = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  flagId: Id<"moderationFlags">,
) => {
  const flag = await ctx.db.get("moderationFlags", flagId);
  if (!flag || flag.orgId !== orgId) throw new ConvexError("This flag no longer exists");
  return flag;
};

export const liftBan = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actorId: Id<"users">,
  banId: Id<"bans">,
) => {
  const ban = await ctx.db.get("bans", banId);
  if (!ban || ban.orgId !== orgId) throw new ConvexError("This ban no longer exists");
  if (ban.liftedAt) return;
  await ctx.db.patch("bans", banId, { liftedAt: Date.now(), liftedBy: actorId });
  await audit(ctx, orgId, actorId, "banLifted", { targetUserId: ban.userId });
};

export const resolveFlag = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actorId: Id<"users">,
  flagId: Id<"moderationFlags">,
) => {
  const flag = await requireOrgFlag(ctx, orgId, flagId);
  if (flag.resolvedAt) return;
  await ctx.db.patch("moderationFlags", flagId, { resolvedAt: Date.now(), resolvedBy: actorId });
};

export const banFromFlag = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actorId: Id<"users">,
  flagId: Id<"moderationFlags">,
) => {
  const flag = await requireOrgFlag(ctx, orgId, flagId);
  const [meeting, member] = await Promise.all([
    ctx.db.get("meetings", flag.meetingId),
    ctx.db.get("meetingMembers", flag.memberId),
  ]);
  if (!meeting || !member) throw new ConvexError("This person is no longer in the room");
  await resolveFlag(ctx, orgId, actorId, flagId);
  if (await findActiveBan(ctx, orgId, { userId: member.userId })) return;
  await banUser(ctx, meeting, member, { reason: flag.reason, flagId, bannedBy: actorId });
  await audit(ctx, orgId, actorId, "userBanned", {
    targetUserId: member.userId,
    detail: flag.reason,
  });
};
