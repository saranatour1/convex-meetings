import { defineSchema } from "convex/server";
import { groupMembers } from "./tables/groupMembers";
import { groups } from "./tables/groups";
import { invites } from "./tables/invites";
import { meetingMembers } from "./tables/meetingMembers";
import { meetings } from "./tables/meetings";
import { meetingTimes } from "./tables/meetingTimes";
import { memberRoles } from "./tables/memberRoles";
import { members } from "./tables/members";
import { messages } from "./tables/messages";
import { organizations } from "./tables/organizations";
import { roles } from "./tables/roles";
import { schedules } from "./tables/schedules";
import { tokens } from "./tables/tokens";
import { users } from "./tables/users";

export default defineSchema({
  users,
  organizations,
  members,
  roles,
  memberRoles,
  tokens,
  invites,
  groups,
  groupMembers,
  meetings,
  meetingTimes,
  meetingMembers,
  messages,
  schedules,
});
