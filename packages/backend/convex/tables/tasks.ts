import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zTask = z.object({
  orgId: zid("organizations"),
  assigneeId: zid("users"),
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
  meetingId: zid("meetings").optional(),
});

export const tasks = defineTable(zodToConvexFields(zTask.shape)).index(
  "by_assignee_and_org_and_done",
  ["assigneeId", "orgId", "done"],
);
