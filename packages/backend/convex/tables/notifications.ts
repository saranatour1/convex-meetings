import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zNotificationKind = z.enum([
  "meetingInvite",
  "meetingCancelled",
  "rsvp",
  "recapReady",
  "missedCall",
]);

export const zNotification = z.object({
  userId: zid("users"),
  kind: zNotificationKind,
  title: z.string().max(200),
  detail: z.string().max(200).optional(),
  meetingCode: z.string().optional(),
  sessionId: zid("meetingSessions").optional(),
  actorId: zid("users").optional(),
  readAt: z.number().optional(),
});

export const notifications = defineTable(zodToConvexFields(zNotification.shape))
  .index("by_user", ["userId"])
  .index("by_user_and_readAt", ["userId", "readAt"]);
