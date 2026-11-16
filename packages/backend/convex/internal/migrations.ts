import { internalMutation } from "../_generated/server";
import { lastOccurrenceEnd } from "../lib/recurrence";

export const clearPresentPeers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("meetingSessions").take(4000);
    for (const session of sessions) {
      if (session.presentPeers !== undefined) {
        await ctx.db.patch("meetingSessions", session._id, { presentPeers: undefined });
      }
    }
  },
});

export const backfillMeetingTimes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const times = await ctx.db.query("meetingTimes").take(4000);
    for (const time of times) {
      if (time.orgId !== undefined && time.repeatUntil !== undefined) continue;
      const meeting = await ctx.db.get("meetings", time.meetingId);
      if (!meeting) continue;
      await ctx.db.patch("meetingTimes", time._id, {
        orgId: meeting.orgId,
        repeatUntil: lastOccurrenceEnd(time.rrule, time),
      });
    }
  },
});

export const stripManageGroups = internalMutation({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").take(4000);
    for (const role of roles) {
      if (role.permissions.manageGroups === undefined) continue;
      const { manageGroups: _dropped, ...permissions } = role.permissions;
      await ctx.db.patch("roles", role._id, { permissions });
    }
  },
});
