import type { Doc } from "@meetings/backend";

type Permission = keyof Doc<"roles">["permissions"];

export const PERMISSIONS: { key: Permission; label: string }[] = [
  { key: "inviteMembers", label: "Invite people" },
  { key: "removeMembers", label: "Remove people" },
  { key: "manageRoles", label: "Manage roles" },
  { key: "manageGroups", label: "Manage teams" },
  { key: "createMeetings", label: "Schedule meetings" },
  { key: "manageMeetings", label: "Manage everyone's meetings and calls" },
  { key: "manageOrganization", label: "Organization settings, links and activity" },
];

export const LOCKED_ROLES = ["Owner", "Admin"];
export const BUILT_IN_ROLES = [...LOCKED_ROLES, "Member"];

type Viewer = { permissions: string[]; isOwner: boolean } | null | undefined;

export const canGrant = (role: Pick<Doc<"roles">, "name" | "permissions">, viewer: Viewer) =>
  Boolean(viewer) &&
  (role.name !== "Owner" || viewer!.isOwner) &&
  Object.entries(role.permissions).every(
    ([permission, granted]) => !granted || viewer!.permissions.includes(permission),
  );
