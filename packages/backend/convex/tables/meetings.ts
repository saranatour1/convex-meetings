import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeetingCode = z
  .string()
  .regex(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/, "Use a code like abc-defg-hij");

export const zMeetingKind = z.enum(["groupCall", "webinar", "classroom", "audioRoom"]);

export const zMeetingAccess = z.enum(["invited", "org", "ask", "link", "public"]);
export const zMeetingInviters = z.enum(["hosts", "everyone"]);

export const zMeeting = z.object({
  orgId: zid("organizations"),
  userId: zid("users"),
  code: zMeetingCode,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  kind: zMeetingKind,
  recap: z.boolean(),
  record: z.boolean().optional(),
  liveTextOff: z.boolean().optional(),
  protected: z.boolean().optional(),
  access: zMeetingAccess.optional(),
  inviters: zMeetingInviters.optional(),
  slowModeSeconds: z.number().int().min(0).max(600).optional(),
  rtkMeetingId: z.string().optional(),
  endedAt: z.number().optional(),
});

export const meetings = defineTable(zodToConvexFields(zMeeting.shape))
  .index("by_org_and_user_and_title", ["orgId", "userId", "title"])
  .index("by_rtk_meeting", ["rtkMeetingId"])
  .index("by_code", ["code"]);
