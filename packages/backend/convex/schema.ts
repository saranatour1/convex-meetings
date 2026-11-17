import { defineSchema } from "convex/server";
import { auditEvents } from "./tables/auditEvents";
import { callPeers } from "./tables/callPeers";
import { invites } from "./tables/invites";
import { joinLinks } from "./tables/joinLinks";
import { annotationSnapshots, strokes } from "./tables/annotations";
import { meetingGuests } from "./tables/meetingGuests";
import { meetingMembers } from "./tables/meetingMembers";
import { meetingSessions } from "./tables/meetingSessions";
import { meetings } from "./tables/meetings";
import { meetingTimes } from "./tables/meetingTimes";
import { memberRoles } from "./tables/memberRoles";
import { members } from "./tables/members";
import { messageReactions } from "./tables/messageReactions";
import { messages } from "./tables/messages";
import { notifications } from "./tables/notifications";
import { organizations } from "./tables/organizations";
import { roles } from "./tables/roles";
import { schedules } from "./tables/schedules";
import { tokens } from "./tables/tokens";
import { usage } from "./tables/usage";
import { userSettings } from "./tables/userSettings";
import { users } from "./tables/users";
import { verifiedSessions } from "./tables/verifiedSessions";

export default defineSchema({
  users,
  verifiedSessions,
  userSettings,
  organizations,
  members,
  roles,
  memberRoles,
  tokens,
  invites,
  joinLinks,
  auditEvents,
  meetings,
  meetingTimes,
  meetingMembers,
  meetingGuests,
  meetingSessions,
  callPeers,
  messages,
  messageReactions,
  strokes,
  annotationSnapshots,
  schedules,
  notifications,
  usage,
});
