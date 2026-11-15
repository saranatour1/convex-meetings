import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zUsernameAuthMethod = z.enum(["usernamePasskey", "usernamePassword"]);
const zAuthMethod = z.enum([...zUsernameAuthMethod.options, "google", "github"]);
export const zBio = z.string().trim().max(280);

export const zUser = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  bio: zBio.optional(),
  imageId: zid("_storage").optional(),
  method: zAuthMethod,
  isVerified: z.boolean(),
});

export const users = defineTable(zodToConvexFields(zUser.shape));
