import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const DURATIONS = [15, 30, 45, 60] as const;
const MINUTE = 60_000;
const YEAR = 365 * 24 * 60 * MINUTE;

/** Normalize and validate a new meeting. Throws a ConvexError with a user-facing message. */
export function checkMeeting(
  input: { title: string; startsAt: number; durationMinutes: number },
  now: number,
) {
  const title = input.title.trim();
  if (!title) throw new ConvexError("Give the meeting a title.");
  if (title.length > 200) throw new ConvexError("Keep the title under 200 characters.");
  if (!(DURATIONS as readonly number[]).includes(input.durationMinutes))
    throw new ConvexError("Pick a duration of 15, 30, 45 or 60 minutes.");
  // A minute of slack so a slot picked right at its start time still saves.
  if (input.startsAt < now - MINUTE) throw new ConvexError("That time has already passed.");
  if (input.startsAt > now + YEAR) throw new ConvexError("Schedule within the next year.");
  return { ...input, title };
}

export const create = mutation({
  args: { title: v.string(), startsAt: v.number(), durationMinutes: v.number() },
  returns: v.id("meetings"),
  handler: async (ctx, args) => {
    const hostId = await getAuthUserId(ctx);
    if (hostId === null) throw new ConvexError("Sign in to schedule meetings.");
    return await ctx.db.insert("meetings", { hostId, ...checkMeeting(args, Date.now()) });
  },
});

/** The caller's meetings that haven't ended yet, soonest first. */
export const upcoming = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("meetings"),
      _creationTime: v.number(),
      hostId: v.id("users"),
      title: v.string(),
      startsAt: v.number(),
      durationMinutes: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const hostId = await getAuthUserId(ctx);
    if (hostId === null) return [];
    // ponytail: Date.now() is frozen per query run, so a meeting that just ended stays listed
    // until the data changes or the page reloads; pass a coarse `now` arg if that matters.
    const now = Date.now();
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_host_and_startsAt", (q) =>
        q.eq("hostId", hostId).gte("startsAt", now - 60 * MINUTE),
      )
      .take(50);
    return meetings.filter((m) => m.startsAt + m.durationMinutes * MINUTE > now);
  },
});
