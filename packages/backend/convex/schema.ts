import { defineSchema } from "convex/server";
import { groupMembers, groups } from "./tables/groups";
import { attendees, meetings } from "./tables/meetings";
import { messages } from "./tables/messages";
import { invites, members, organizations } from "./tables/organizations";
import { schedules } from "./tables/schedules";
import { tasks } from "./tables/tasks";
import { users } from "./tables/users";

export default defineSchema({
  users,
  organizations,
  members,
  invites,
  groups,
  groupMembers,
  meetings,
  attendees,
  schedules,
  messages,
  tasks,
});
