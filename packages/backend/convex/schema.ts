import { defineSchema } from "convex/server";
import { auditEvents } from "./tables/auditEvents";
import { groupMembers } from "./tables/groupMembers";
import { groups } from "./tables/groups";
import { invites } from "./tables/invites";
import { joinLinks } from "./tables/joinLinks";
import { meetingMembers } from "./tables/meetingMembers";
import { meetingSessions } from "./tables/meetingSessions";
import { meetings } from "./tables/meetings";
import { meetingTimes } from "./tables/meetingTimes";
import { memberRoles } from "./tables/memberRoles";
import { members } from "./tables/members";
import { messages } from "./tables/messages";
import { notifications } from "./tables/notifications";
import { organizations } from "./tables/organizations";
import { roles } from "./tables/roles";
import { schedules } from "./tables/schedules";
import { tokens } from "./tables/tokens";
import { userSettings } from "./tables/userSettings";
import { users } from "./tables/users";

export default defineSchema({
  users,
  userSettings,
  organizations,
  members,
  roles,
  memberRoles,
  tokens,
  invites,
  joinLinks,
  auditEvents,
  groups,
  groupMembers,
  meetings,
  meetingTimes,
  meetingMembers,
  meetingSessions,
  messages,
  schedules,
  notifications,
});
