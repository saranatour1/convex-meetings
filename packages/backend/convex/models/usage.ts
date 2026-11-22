import { ConvexError } from "convex/values";
import { DateTime } from "luxon";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zUsage } from "../tables/usage";

export const LIMITS = {
  callSecondsPerMonth: 9_000 * 60,
  recordingSecondsPerMonth: 90 * 60,
  emailsPerMonth: 2_700,
};

const LIVE_TEXT_OFF = "liveTextOff";
const RECORDING_STOPPED = new Set(["UPLOADING", "UPLOADED", "ERRORED"]);

const utc = (now: number) => DateTime.fromMillis(now, { zone: "utc" });
const monthKey = (kind: string, now: number) => `${kind}:${utc(now).toFormat("yyyy-LL")}`;
const nextMonth = (now: number) => utc(now).startOf("month").plus({ months: 1 }).toFormat("LLLL d");

const rowOf = (ctx: QueryCtx, key: string) =>
  ctx.db
    .query("usage")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

const amountOf = async (ctx: QueryCtx, key: string) => (await rowOf(ctx, key))?.amount ?? 0;

const setAmount = async (ctx: MutationCtx, key: string, amount: number) => {
  const row = await rowOf(ctx, key);
  const value = parseOrThrow(zUsage, { key, amount });
  if (row) await ctx.db.patch("usage", row._id, value);
  else await ctx.db.insert("usage", value);
};

const addAmount = async (ctx: MutationCtx, key: string, amount: number) => {
  if (amount > 0) await setAmount(ctx, key, (await amountOf(ctx, key)) + amount);
};

const minutesSince = (from: number | undefined, now: number) =>
  from === undefined ? 0 : Math.max(0, now - from) / 60_000;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const liveTextOn = async (ctx: QueryCtx) => (await amountOf(ctx, LIVE_TEXT_OFF)) === 0;

export const recordPeerUsage = async (ctx: MutationCtx, peer: Doc<"callPeers">, at: number) => {
  const minutes = minutesSince(peer.connectedAt, at);
  await addAmount(ctx, monthKey("callSeconds", at), minutes * 60);
};

export const recordRecordingStatus = async (
  ctx: MutationCtx,
  session: Doc<"meetingSessions">,
  status: string | undefined,
  now: number,
): Promise<Partial<Doc<"meetingSessions">>> => {
  if (status === "RECORDING" && !session.recordingStartedAt) return { recordingStartedAt: now };
  if (status && RECORDING_STOPPED.has(status) && session.recordingStartedAt) {
    await addAmount(
      ctx,
      monthKey("recordingSeconds", now),
      minutesSince(session.recordingStartedAt, now) * 60,
    );
    return { recordingStartedAt: undefined };
  }
  return {};
};

export const spendEmail = async (ctx: MutationCtx) => {
  const now = Date.now();
  const key = monthKey("emails", now);
  if ((await amountOf(ctx, key)) >= LIMITS.emailsPerMonth) {
    throw new ConvexError(
      `This month's free emails are used up. Share the link instead, or try again on ${nextMonth(now)}.`,
    );
  }
  await addAmount(ctx, key, 1);
};

const currentUsage = async (ctx: QueryCtx, now: number) => {
  const peers = await ctx.db.query("callPeers").take(1000);
  const recordings = await ctx.db
    .query("meetingSessions")
    .withIndex("by_recording_started", (q) => q.gt("recordingStartedAt", 0))
    .take(100);
  const peerMinutes = (list: Doc<"callPeers">[]) =>
    sum(list.map((peer) => minutesSince(peer.connectedAt, now)));
  return {
    callSeconds: (await amountOf(ctx, monthKey("callSeconds", now))) + peerMinutes(peers) * 60,
    recordingSeconds:
      (await amountOf(ctx, monthKey("recordingSeconds", now))) +
      sum(recordings.map((session) => minutesSince(session.recordingStartedAt, now) * 60)),
  };
};

export const joinBudget = async (ctx: QueryCtx) => {
  const now = Date.now();
  const used = await currentUsage(ctx, now);
  return {
    callsPausedUntil: used.callSeconds < LIMITS.callSecondsPerMonth ? null : nextMonth(now),
    recordingSeconds: Math.max(
      0,
      Math.floor(LIMITS.recordingSecondsPerMonth - used.recordingSeconds),
    ),
  };
};
