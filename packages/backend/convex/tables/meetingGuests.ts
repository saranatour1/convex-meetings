import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeetingGuest = z.object({
  meetingId: zid("meetings"),
  userId: zid("users"),
  tokenId: zid("tokens"),
  invitedBy: zid("users").optional(),
  emailError: z.string().optional(),
});

export const meetingGuests = defineTable(zodToConvexFields(zMeetingGuest.shape))
  .index("by_token", ["tokenId"])
  .index("by_meeting", ["meetingId"]);
