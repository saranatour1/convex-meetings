import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { moderationWorkpool } from "../lib/workpools";

export type FrameReport = {
  storageId: Id<"_storage">;
  meetingId: Id<"meetings">;
  targetMemberId: Id<"meetingMembers">;
  reporterId: Id<"meetingMembers">;
};

export const queueMessageCheck = (ctx: MutationCtx, messageId: Id<"messages">) =>
  moderationWorkpool.enqueueAction(
    ctx,
    internal.internal.moderation.screenMessage,
    { messageId },
    { onComplete: internal.internal.moderation.messageScreened, context: { messageId } },
  );

export const queueNameCheck = (ctx: MutationCtx, memberId: Id<"meetingMembers">) =>
  moderationWorkpool.enqueueAction(
    ctx,
    internal.internal.moderation.screenName,
    { memberId },
    { onComplete: internal.internal.moderation.nameScreened, context: { memberId } },
  );

export const queueFrameCheck = (ctx: MutationCtx, frame: FrameReport) =>
  moderationWorkpool.enqueueAction(
    ctx,
    internal.internal.moderation.screenFrame,
    { storageId: frame.storageId },
    { onComplete: internal.internal.moderation.frameScreened, context: frame },
  );

export const queueSummaryCheck = (ctx: MutationCtx, sessionId: Id<"meetingSessions">) =>
  moderationWorkpool.enqueueAction(
    ctx,
    internal.internal.moderation.screenSummary,
    { sessionId },
    { onComplete: internal.internal.moderation.summaryScreened, context: { sessionId } },
  );
