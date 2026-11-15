import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vAuthMethod = v.union(
  v.literal("usernamePasskey"),
  v.literal("usernamePassword"),
  v.literal("google"),
  v.literal("github"),
);

export default defineSchema({
  users: defineTable({
    // Username methods leave `name` unset; `viewer` falls back to the username.
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    // The method the account was created with.
    method: vAuthMethod,
    // Whether the provider vouched for the email. Always false for username methods.
    isVerified: v.boolean(),
  }),
  meetings: defineTable({
    hostId: v.id("users"),
    title: v.string(),
    startsAt: v.number(), // ms since epoch
    durationMinutes: v.number(),
  }).index("by_host_and_startsAt", ["hostId", "startsAt"]),
});
