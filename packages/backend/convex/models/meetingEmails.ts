import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { IcsMethod } from "../lib/ics";
import { emailWorkpool } from "../lib/workpools";

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
    });
  }
};
