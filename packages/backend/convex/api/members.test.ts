import { expect, test } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";

const page = { numItems: 50, cursor: null };

const orgWithMember = async () => {
  const t = testBackend();
  const owner = await signIn(t, "Owner");
  const bea = await signIn(t, "Bea");
  const orgId = await owner.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const roles = await owner.asUser.query(api.api.orgs.roles, { orgId, paginationOpts: page });
  const role = (name: string) => roles.page.find((r) => r.name === name)!._id;
  await addOrgMember(t, orgId, bea.userId, "Member");
  const members = await owner.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  const memberOf = (userId: typeof bea.userId) => members.page.find((m) => m.userId === userId)!;
  return { t, owner, bea, orgId, ownerRole: role("Owner"), memberRole: role("Member"), memberOf };
};

test("owners change roles, and the last owner can't step down", async () => {
  const { owner, bea, orgId, ownerRole, memberRole, memberOf } = await orgWithMember();
  await owner.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: memberOf(bea.userId)._id,
    roleId: ownerRole,
  });
  await owner.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: memberOf(owner.userId)._id,
    roleId: memberRole,
  });
  const members = await bea.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  expect(members.page.find((m) => m.userId === bea.userId)?.roles).toEqual([
    { _id: ownerRole, name: "Owner" },
  ]);
  await expect(
    bea.asUser.mutation(api.api.members.setRole, {
      orgId,
      memberId: memberOf(bea.userId)._id,
      roleId: memberRole,
    }),
  ).rejects.toThrow("at least one owner");
});

test("members without manageRoles can't change roles or rename the org", async () => {
  const { bea, orgId, ownerRole, memberOf } = await orgWithMember();
  await expect(
    bea.asUser.mutation(api.api.members.setRole, {
      orgId,
      memberId: memberOf(bea.userId)._id,
      roleId: ownerRole,
    }),
  ).rejects.toThrow("Not allowed");
  await expect(bea.asUser.mutation(api.api.orgs.rename, { orgId, name: "Mine" })).rejects.toThrow(
    "Not allowed",
  );
});

test("anyone can leave, except the last owner", async () => {
  const { owner, bea, orgId } = await orgWithMember();
  await bea.asUser.mutation(api.api.members.leave, { orgId });
  expect((await bea.asUser.query(api.api.orgs.listMine, { paginationOpts: page })).page).toEqual(
    [],
  );
  await expect(owner.asUser.mutation(api.api.members.leave, { orgId })).rejects.toThrow(
    "at least one owner",
  );
});

test("roles can be created, edited and deleted; built-in roles are protected", async () => {
  const { owner, bea, orgId, ownerRole, memberRole, memberOf } = await orgWithMember();
  await owner.asUser.mutation(api.api.orgs.rename, { orgId, name: "  Acme Inc  " });
  expect(await owner.asUser.query(api.api.orgs.get, { orgId })).toMatchObject({ name: "Acme Inc" });

  const hostRole = await owner.asUser.mutation(api.api.roles.create, {
    orgId,
    name: "Host",
    permissions: { createMeetings: true, manageMeetings: true },
  });
  await expect(
    owner.asUser.mutation(api.api.roles.create, { orgId, name: "Host", permissions: {} }),
  ).rejects.toThrow("already a Host role");
  await owner.asUser.mutation(api.api.roles.update, {
    orgId,
    roleId: hostRole,
    permissions: { createMeetings: true },
  });
  await owner.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: memberOf(bea.userId)._id,
    roleId: hostRole,
  });
  await owner.asUser.mutation(api.api.roles.remove, { orgId, roleId: hostRole });
  const members = await owner.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  expect(members.page.find((m) => m.userId === bea.userId)?.roles).toEqual([
    { _id: memberRole, name: "Member" },
  ]);

  await expect(
    owner.asUser.mutation(api.api.roles.update, { orgId, roleId: ownerRole, permissions: {} }),
  ).rejects.toThrow("always has every permission");
  await expect(
    owner.asUser.mutation(api.api.roles.remove, { orgId, roleId: memberRole }),
  ).rejects.toThrow("can't be deleted");
});
