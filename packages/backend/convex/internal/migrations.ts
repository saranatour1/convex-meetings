import { internalMutation } from "../_generated/server";

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
