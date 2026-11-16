import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";
import { zTimeZone } from "../lib/time";

export const zUser = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().optional(),
  bio: z.string().trim().max(280).optional(),
  imageId: zid("_storage").optional(),
  method: z.enum(["usernamePasskey", "usernamePassword", "google", "github", "guest"]),
  isVerified: z.boolean(),
  seenTimeZone: zTimeZone.optional(),
});

export const users = defineTable(zodToConvexFields(zUser.shape)).index("by_email", ["email"]);
