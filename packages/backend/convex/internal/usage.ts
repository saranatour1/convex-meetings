import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { overBudget } from "../models/usage";

export const enforce = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { endCalls, stopRecordings, liveText } = await overBudget(ctx);
    for (const rtkMeetingId of endCalls) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.kickAll, { rtkMeetingId });
    }
    for (const rtkMeetingId of stopRecordings) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.stopRecordings, { rtkMeetingId });
    }
    if (liveText !== null) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.setLiveText, { on: liveText });
    }
  },
});
