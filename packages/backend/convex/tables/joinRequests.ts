import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zJoinRequest = z.object({
  meetingId: zid("meetings"),
  userId: zid("users"),
  status: z.enum(["waiting", "denied"]),
  tokenId: zid("tokens").optional(),
});

export const joinRequests = defineTable(zodToConvexFields(zJoinRequest.shape))
  .index("by_meeting_and_status", ["meetingId", "status"])
  .index("by_meeting_and_user", ["meetingId", "userId"])
  .index("by_token", ["tokenId"]);
