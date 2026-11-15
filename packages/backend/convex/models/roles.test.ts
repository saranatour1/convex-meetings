import { expect, test } from "vite-plus/test";
import { mergePermissions } from "./roles";

test("a member holds every permission granted by any of their roles", () => {
  const permissions = mergePermissions([
    { permissions: { createMeetings: true, inviteMembers: false } },
    { permissions: { inviteMembers: true } },
  ]);
  expect([...permissions].sort()).toEqual(["createMeetings", "inviteMembers"]);
});

test("permissions set to false are not granted", () => {
  expect(mergePermissions([{ permissions: { manageRoles: false } }]).size).toBe(0);
});
