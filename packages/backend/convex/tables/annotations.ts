import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zStrokeColor = z.enum(["red", "yellow", "green", "blue", "white"]);

export const zStroke = z.object({
  meetingId: zid("meetings"),
  shareId: z.string().min(1).max(100),
  memberId: zid("meetingMembers"),
  color: zStrokeColor,
  points: z.array(z.number().min(0).max(1)).min(2).max(1000),
});

export const strokes = defineTable(zodToConvexFields(zStroke.shape)).index("by_meeting_and_share", [
  "meetingId",
  "shareId",
]);

export const zAnnotationSnapshot = z.object({
  meetingId: zid("meetings"),
  memberId: zid("meetingMembers"),
  storageId: zid("_storage"),
});

export const annotationSnapshots = defineTable(zodToConvexFields(zAnnotationSnapshot.shape)).index(
  "by_meeting",
  ["meetingId"],
);
