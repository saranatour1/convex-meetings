import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeetingSession = z.object({
  meetingId: zid("meetings"),
  rtkSessionId: z.string(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  attendeeIds: z.array(z.string()).max(1000),
  summary: z.string().optional(),
  transcriptUrl: z.string().optional(),
  recordingUrl: z.string().optional(),
  transcriptId: zid("_storage").optional(),
  recordingKey: z.string().optional(),
  recordingSeconds: z.number().optional(),
});

export const meetingSessions = defineTable(zodToConvexFields(zMeetingSession.shape))
  .index("by_meeting", ["meetingId"])
  .index("by_rtk_session", ["rtkSessionId"]);
