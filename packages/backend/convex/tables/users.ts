import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zUser = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  bio: z.string().trim().max(280).optional(),
  imageId: zid("_storage").optional(),
  method: z.enum(["usernamePasskey", "usernamePassword", "google", "github"]),
  isVerified: z.boolean(),
});

export const users = defineTable(zodToConvexFields(zUser.shape));
