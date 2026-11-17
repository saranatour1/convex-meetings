import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { expireRing } from "../models/rings";

export const expire = internalMutation({
  args: { ringId: v.id("rings") },
  handler: (ctx, { ringId }) => expireRing(ctx, ringId),
});
