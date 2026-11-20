import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { IcsMethod } from "../lib/ics";
import { emailWorkpool } from "../lib/workpools";
import { GUEST_PASS_MS, issueToken } from "./invites";

const invitedGuest = async (ctx: MutationCtx, meetingId: Id<"meetings">, userId: Id<"users">) => {
  const guest = await ctx.db
    .query("meetingGuests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return guest?.meetingId === meetingId && guest.invitedBy ? guest : null;
};

export const queueMeetingEmails = async (
  ctx: MutationCtx,
  method: IcsMethod,
  meeting: Doc<"meetings">,
  time: Doc<"meetingTimes">,
  userIds: Id<"users">[],
) => {
  const host = await ctx.db.get("users", meeting.userId);
  for (const userId of userIds) {
    const user = await ctx.db.get("users", userId);
    if (!user?.email) continue;
    const guest =
      method === "REQUEST" && user.method === "guest"
        ? await invitedGuest(ctx, meeting._id, userId)
        : null;
    if (guest) {
      const { secret } = await issueToken(ctx, GUEST_PASS_MS, guest._id);
      await emailWorkpool.enqueueAction(ctx, internal.internal.guests.sendInvite, {
        guestId: guest._id,
        secret,
      });
      continue;
    }
    await emailWorkpool.enqueueAction(ctx, internal.internal.meetingEmails.send, {
      method,
      orgId: meeting.orgId,
      code: meeting.code,
      title: meeting.title,
      hostName: host?.name ?? "Someone",
      to: { name: user.name ?? user.email, email: user.email },
      startsAt: time.startsAt,
      endsAt: time.endsAt,
      timeZone: time.timeZone,
      rrule: time.rrule,
      sequence: time.sequence ?? 0,
    });
  }
};
