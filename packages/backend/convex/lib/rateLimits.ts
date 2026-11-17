import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  invite: { kind: "token bucket", rate: 100, period: HOUR, capacity: 50 },
  joinLink: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  accept: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  chat: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  join: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 5 },
  guestEnter: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  meetingInvite: { kind: "token bucket", rate: 100, period: HOUR, capacity: 30 },
  reaction: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
  stroke: { kind: "token bucket", rate: 600, period: MINUTE, capacity: 60 },
  meeting: { kind: "fixed window", rate: 10, period: DAY },
  ring: { kind: "token bucket", rate: 30, period: HOUR, capacity: 5 },
  joinAsk: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  guestRename: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  frameUpload: { kind: "token bucket", rate: 4, period: MINUTE, capacity: 4 },
  frameCheck: { kind: "token bucket", rate: 2, period: MINUTE, capacity: 1 },
  frameRecheck: { kind: "token bucket", rate: 6, period: MINUTE, capacity: 3 },
});

export type RateLimit = keyof NonNullable<typeof rateLimiter.limits>;

const LIMIT_MESSAGES: Partial<Record<RateLimit, string>> = {
  meeting: "You can create 10 meetings a day.",
};

const waitFor = (ms: number) => {
  if (ms < 2 * MINUTE) return `${Math.max(1, Math.ceil(ms / 1000))} seconds`;
  if (ms < 2 * HOUR) return `${Math.ceil(ms / MINUTE)} minutes`;
  return `${Math.ceil(ms / HOUR)} hours`;
};

export const enforceRateLimit = async (
  ctx: MutationCtx | ActionCtx,
  name: RateLimit,
  key: string,
  count = 1,
) => {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key, count });
  if (!ok) {
    throw new ConvexError(
      `${LIMIT_MESSAGES[name] ?? "Too many tries."} Try again in ${waitFor(retryAfter ?? 0)}.`,
    );
  }
};

export const hasRateLimitRoom = async (ctx: MutationCtx, name: RateLimit, key: string) =>
  (await rateLimiter.check(ctx, name, { key })).ok;

export const tryRateLimit = async (ctx: MutationCtx | ActionCtx, name: RateLimit, key: string) =>
  (await rateLimiter.limit(ctx, name, { key })).ok;

export const enforceSlowMode = async (ctx: MutationCtx, key: string, seconds: number) => {
  if (seconds <= 0) return;
  const { ok, retryAfter } = await rateLimiter.limit(ctx, "slowMode", {
    key,
    config: { kind: "token bucket", rate: 1, period: seconds * 1000, capacity: 1 },
  });
  if (!ok) {
    throw new ConvexError(
      `Slow mode is on. You can send another message in ${waitFor(retryAfter ?? 0)}.`,
    );
  }
};
