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
  attendance: z
    .array(
      z.object({
        memberId: zid("meetingMembers"),
        joinedAt: z.number(),
        leftAt: z.number().optional(),
        seconds: z.number().min(0),
      }),
    )
    .max(1000)
    .optional(),
  summary: z.string().optional(),
  summaryCheck: z.enum(["ok", "hidden"]).optional(),
  transcriptUrl: z.string().optional(),
  recordingUrl: z.string().optional(),
  transcriptId: zid("_storage").optional(),
  recordingKey: z.string().optional(),
  recordingSeconds: z.number().optional(),
  recordingStartedAt: z.number().optional(),
});

export const meetingSessions = defineTable(zodToConvexFields(zMeetingSession.shape))
  .index("by_meeting", ["meetingId"])
  .index("by_meeting_and_number", ["meetingId", "number"])
  .index("by_rtk_session", ["rtkSessionId"])
  .index("by_org_and_ended", ["orgId", "endedAt"])
  .index("by_recording_started", ["recordingStartedAt"]);
