import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zStrokeColor = z.enum(["red", "yellow", "green", "blue", "white"]);

export const zStrokeTool = z.enum(["pen", "highlighter", "arrow", "rectangle", "ellipse", "text"]);

const COORDS: Record<z.infer<typeof zStrokeTool>, [number, number]> = {
  pen: [2, 1000],
  highlighter: [2, 1000],
  arrow: [4, 4],
  rectangle: [4, 4],
  ellipse: [4, 4],
  text: [2, 2],
};

export const zStroke = z
  .object({
    meetingId: zid("meetings"),
    shareId: z.string().min(1).max(100),
    memberId: zid("meetingMembers"),
    tool: zStrokeTool.optional(),
    color: zStrokeColor,
    points: z.array(z.number().min(0).max(1)).min(2).max(1000),
    text: z.string().trim().min(1).max(280).optional(),
    removedAt: z.number().optional(),
  })
  .refine(
    ({ tool = "pen", points }) => {
      const [min, max] = COORDS[tool];
      return points.length % 2 === 0 && points.length >= min && points.length <= max;
    },
    { message: "That shape has the wrong number of points" },
  )
  .refine(({ tool, text }) => (tool === "text") === (text !== undefined), {
    message: "Only text notes have text, and they need some",
  });

export const strokes = defineTable(zodToConvexFields(zStroke.shape)).index("by_meeting_and_share", [
  "meetingId",
  "shareId",
  "removedAt",
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
