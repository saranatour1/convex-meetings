import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zMeeting = z.object({
  orgId: zid("organizations"),
  userId: zid("users"),
  title: z.string().trim().min(1).max(200),
});

export const meetings = defineTable(zodToConvexFields(zMeeting.shape)).index(
  "by_org_and_user_and_title",
  ["orgId", "userId", "title"],
);
