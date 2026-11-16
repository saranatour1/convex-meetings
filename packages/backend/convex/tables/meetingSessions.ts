import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeetingSession = z.object({
  meetingId: zid("meetings"),
  orgId: zid("organizations").optional(),
  rtkSessionId: z.string(),
  number: z.number().int().min(1),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  attendeeIds: z.array(z.string()).max(1000),
  presentIds: z.array(z.string()).max(1000).optional(),
  summary: z.string().optional(),
  transcriptUrl: z.string().optional(),
  recordingUrl: z.string().optional(),
  transcriptId: zid("_storage").optional(),
  recordingKey: z.string().optional(),
  recordingSeconds: z.number().optional(),
});

export const meetingSessions = defineTable(zodToConvexFields(zMeetingSession.shape))
  .index("by_meeting", ["meetingId"])
  .index("by_meeting_and_number", ["meetingId", "number"])
  .index("by_rtk_session", ["rtkSessionId"])
  .index("by_org_and_ended", ["orgId", "endedAt"]);
