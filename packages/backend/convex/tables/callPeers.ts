import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zCallPeer = z.object({
  sessionId: zid("meetingSessions"),
  meetingId: zid("meetings"),
  memberId: zid("meetingMembers"),
  peerId: z.string(),
});

export const callPeers = defineTable(zodToConvexFields(zCallPeer.shape))
  .index("by_session_and_peer", ["sessionId", "peerId"])
  .index("by_meeting_and_member", ["meetingId", "memberId"]);
