import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { askJev } from "../lib/jev";
import {
  FRAME_QUESTIONS,
  FRAME_SOURCE,
  MESSAGE_QUESTIONS,
  NAME_QUESTIONS,
  decideMessage,
  frameScores,
  messageScores,
  nameScores,
  type FrameScores,
  type MessageScores,
  type NameScores,
} from "../lib/moderation";
import {
  applyFrameVerdict,
  applyMessageVerdict,
  applyNameVerdict,
  applySummaryVerdict,
  dropEvidence as dropFlagEvidence,
  dropPendingMessage,
  messageState as readMessageState,
  nameState as readNameState,
  summaryState as readSummaryState,
} from "../models/moderation";

type MessageState = Awaited<ReturnType<typeof readMessageState>>;
type NameState = Awaited<ReturnType<typeof readNameState>>;
type SummaryState = Awaited<ReturnType<typeof readSummaryState>>;
type ScreenedName = { name: string; scores: NameScores };

const PROBE_MESSAGES = [
  "good morning everyone, what are you all working on?",
  "this playlist is perfect for studying, thanks for sharing",
  "taking a ten minute break, back soon",
  "you're an idiot and nobody here likes you",
  "people like you should go back to where you came from",
  "I know where you live and I'm coming for you",
  "ugh this room is so boring today",
  "can you stop typing so loud, some of us are working",
  "whatever, your opinion doesn't matter anyway",
  "this exam is killing me",
  "you're so bad at this lol, love you though",
  "follow my channel for free followers, link in my profile",
];

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const askAboutMessage = async (state: NonNullable<MessageState | SummaryState>) =>
  messageScores((await askJev(state, MESSAGE_QUESTIONS)).answers);

export const messageState = internalQuery({
  args: { messageId: v.id("messages") },
  handler: (ctx, { messageId }) => readMessageState(ctx, messageId),
});

export const screenMessage = internalAction({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }): Promise<MessageScores | null> => {
    const state: MessageState = await ctx.runQuery(internal.internal.moderation.messageState, {
      messageId,
    });
    return state ? askAboutMessage(state) : null;
  },
});

export const messageScreened = internalMutation({
  args: vOnCompleteArgs(v.object({ messageId: v.id("messages") })),
  handler: async (ctx, { context, result }) => {
    const scores = result.kind === "success" ? (result.returnValue as MessageScores | null) : null;
    if (scores) await applyMessageVerdict(ctx, context.messageId, scores);
    else await dropPendingMessage(ctx, context.messageId);
  },
});

export const nameState = internalQuery({
  args: { memberId: v.id("meetingMembers") },
  handler: (ctx, { memberId }) => readNameState(ctx, memberId),
});

export const screenName = internalAction({
  args: { memberId: v.id("meetingMembers") },
  handler: async (ctx, { memberId }): Promise<ScreenedName | null> => {
    const state: NameState = await ctx.runQuery(internal.internal.moderation.nameState, {
      memberId,
    });
    if (!state) return null;
    return { name: state.name, scores: nameScores((await askJev(state, NAME_QUESTIONS)).answers) };
  },
});

export const nameScreened = internalMutation({
  args: vOnCompleteArgs(v.object({ memberId: v.id("meetingMembers") })),
  handler: async (ctx, { context, result }) => {
    const screened = result.kind === "success" ? (result.returnValue as ScreenedName | null) : null;
    if (screened) await applyNameVerdict(ctx, context.memberId, screened.name, screened.scores);
  },
});

export const screenFrame = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<FrameScores | null> => {
    const blob = await ctx.storage.get(storageId);
    if (!blob) return null;
    const { answers } = await askJev({ source: FRAME_SOURCE, frame: storageId }, FRAME_QUESTIONS, {
      [storageId]: {
        type: "image",
        format: "jpg",
        data_base64: toBase64(new Uint8Array(await blob.arrayBuffer())),
      },
    });
    return frameScores(answers);
  },
});

export const frameScreened = internalMutation({
  args: vOnCompleteArgs(
    v.object({
      storageId: v.id("_storage"),
      meetingId: v.id("meetings"),
      targetMemberId: v.id("meetingMembers"),
      reporterId: v.id("meetingMembers"),
    }),
  ),
  handler: (ctx, { context, result }) =>
    applyFrameVerdict(
      ctx,
      context,
      result.kind === "success" ? (result.returnValue as FrameScores | null) : null,
    ),
});

export const dropEvidence = internalMutation({
  args: { flagId: v.id("moderationFlags") },
  handler: (ctx, { flagId }) => dropFlagEvidence(ctx, flagId),
});

export const summaryState = internalQuery({
  args: { sessionId: v.id("meetingSessions") },
  handler: (ctx, { sessionId }) => readSummaryState(ctx, sessionId),
});

export const screenSummary = internalAction({
  args: { sessionId: v.id("meetingSessions") },
  handler: async (ctx, { sessionId }): Promise<MessageScores | null> => {
    const state: SummaryState = await ctx.runQuery(internal.internal.moderation.summaryState, {
      sessionId,
    });
    return state ? askAboutMessage(state) : null;
  },
});

export const summaryScreened = internalMutation({
  args: vOnCompleteArgs(v.object({ sessionId: v.id("meetingSessions") })),
  handler: async (ctx, { context, result }) => {
    const scores = result.kind === "success" ? (result.returnValue as MessageScores | null) : null;
    if (scores) await applySummaryVerdict(ctx, context.sessionId, scores);
  },
});

export const probe = internalAction({
  args: { frame: v.optional(v.id("_storage")) },
  handler: async (ctx, { frame }) => {
    const room = { title: "Quiet study hall", description: "Bring your work and sit with us." };
    const messages = await Promise.all(
      PROBE_MESSAGES.map(async (text) => {
        const { answers, cost } = await askJev(
          { room, message: { author: "Sam", text } },
          MESSAGE_QUESTIONS,
        );
        const scores = messageScores(answers);
        return { text, scores, verdict: decideMessage(scores), cost };
      }),
    );
    const blob = frame ? await ctx.storage.get(frame) : null;
    const image =
      frame && blob
        ? await askJev({ source: FRAME_SOURCE, frame }, FRAME_QUESTIONS, {
            [frame]: {
              type: "image",
              format: "jpg",
              data_base64: toBase64(new Uint8Array(await blob.arrayBuffer())),
            },
          })
            .then(({ answers, cost }) => ({ scores: frameScores(answers), cost }))
            .catch((error: unknown) => ({ error: String(error) }))
        : null;
    return { messages, image };
  },
});
