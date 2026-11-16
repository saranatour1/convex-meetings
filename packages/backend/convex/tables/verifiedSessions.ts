import { defineTable } from "convex/server";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zVerifiedSession = z.object({
  sessionId: z.string().min(1),
});

export const verifiedSessions = defineTable(zodToConvexFields(zVerifiedSession.shape)).index(
  "by_sessionId",
  ["sessionId"],
);
