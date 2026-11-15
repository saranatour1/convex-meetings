import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vUsernameAuthMethod = v.union(
  v.literal("usernamePasskey"),
  v.literal("usernamePassword"),
);

export const vAuthMethod = v.union(
  ...vUsernameAuthMethod.members,
  v.literal("google"),
  v.literal("github"),
);

export const users = defineTable({
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  bio: v.optional(v.string()),
  imageId: v.optional(v.id("_storage")),
  method: vAuthMethod,
  isVerified: v.boolean(),
});

export const vViewer = v.object({
  ...users.validator.fields,
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  imageUrl: v.union(v.string(), v.null()),
});
