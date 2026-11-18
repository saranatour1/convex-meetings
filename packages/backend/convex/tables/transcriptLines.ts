import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zTranscriptLine = z.object({
  meetingId: zid("meetings"),
  memberId: zid("meetingMembers"),
  text: z.string().trim().min(1).max(2000),
  at: z.number(),
});

export const transcriptLines = defineTable(zodToConvexFields(zTranscriptLine.shape)).index(
  "by_meeting_and_at",
  ["meetingId", "at"],
);
