import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { expirePresence } from "../models/agents";

export const expire = internalMutation({
  args: { presenceId: v.id("agentPresence"), seenAt: v.number() },
  handler: (ctx, { presenceId, seenAt }) => expirePresence(ctx, presenceId, seenAt),
});
