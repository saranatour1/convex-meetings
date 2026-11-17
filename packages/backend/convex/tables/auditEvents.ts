import { defineTable } from "convex/server";
import { zid, zodToConvexFields } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zAuditAction = z.enum([
  "orgRenamed",
  "memberJoined",
  "memberRemoved",
  "memberLeft",
  "memberRoleChanged",
  "memberSignedOut",
  "roleCreated",
  "roleUpdated",
  "roleDeleted",
  "inviteSent",
  "inviteRevoked",
  "joinLinkCreated",
  "joinLinkRevoked",
  "joinDomainChanged",
  "callMemberRemoved",
  "callEnded",
  "roomCreated",
  "roomClosed",
  "userBanned",
  "banLifted",
]);

export const zAuditEvent = z.object({
  orgId: zid("organizations"),
  actorId: zid("users"),
  action: zAuditAction,
  targetUserId: zid("users").optional(),
  detail: z.string().max(200).optional(),
});

export const auditEvents = defineTable(zodToConvexFields(zAuditEvent.shape)).index("by_org", [
  "orgId",
]);
