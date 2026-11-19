import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zAnnotationLock = z.object({
  meetingId: zid("meetings"),
  shareId: z.string().min(1).max(100),
});

export const annotationLocks = defineTable(zodToConvexFields(zAnnotationLock.shape)).index(
  "by_meeting_and_share",
  ["meetingId", "shareId"],
);
