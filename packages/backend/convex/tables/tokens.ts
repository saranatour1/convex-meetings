import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zToken = z.object({
  value: z.string().min(32),
  expiresAt: z.number(),
  guestId: zid("meetingGuests").optional(),
});

export const tokens = defineTable(zodToConvexFields(zToken.shape))
  .index("by_value", ["value"])
  .index("by_expiresAt", ["expiresAt"]);
