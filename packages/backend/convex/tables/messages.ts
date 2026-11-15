import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMessage = z.object({
  chatId: z.union([zid("meetings"), zid("groups")]),
  authorId: zid("users"),
  body: z.string().trim().min(1).max(4000),
});

export const messages = defineTable(zodToConvexFields(zMessage.shape)).index("by_chat", ["chatId"]);
