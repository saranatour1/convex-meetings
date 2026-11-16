import { afterEach, expect, test, vi } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const page = { numItems: 50, cursor: null };

afterEach(() => {
  vi.useRealTimers();
});

const setup = async () => {
  const t = testBackend();
  const owner = await signIn(t, "Owner");
  const ada = await signIn(t, "Ada");
  const bea = await signIn(t, "Bea");
  const orgId = await owner.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const roles = await owner.asUser.query(api.api.orgs.roles, { orgId, paginationOpts: page });
  const role = (name: string) => roles.page.find((r) => r.name === name)!._id;
  const join = (userId: Id<"users">, roleId: Id<"roles">) =>
    t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", { orgId, userId });
      await ctx.db.insert("memberRoles", { orgId, memberId, roleId });
      return memberId;
    });
  const adaMember = await join(ada.userId, role("Admin"));
  const beaMember = await join(bea.userId, role("Member"));
  const ownerMember = await t.run(
    async (ctx) =>
      (await ctx.db
        .query("members")
        .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", owner.userId))
        .unique())!._id,
  );
  return { t, owner, ada, bea, orgId, role, adaMember, beaMember, ownerMember };
};

test("admins manage people but can't make or touch owners", async () => {
  const { owner, ada, orgId, role, adaMember, beaMember, ownerMember } = await setup();
  await ada.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: beaMember,
    roleId: role("Admin"),
  });
  await expect(
    ada.asUser.mutation(api.api.members.setRole, {
      orgId,
      memberId: beaMember,
      roleId: role("Owner"),
    }),
  ).rejects.toThrow("Only owners");
  await expect(
    ada.asUser.mutation(api.api.members.setRole, {
      orgId,
      memberId: adaMember,
      roleId: role("Owner"),
    }),
  ).rejects.toThrow("Only owners");
  await expect(
    ada.asUser.mutation(api.api.members.remove, { orgId, memberId: ownerMember }),
  ).rejects.toThrow("Only owners");
  await expect(
    ada.asUser.mutation(api.api.roles.update, {
      orgId,
      roleId: role("Admin"),
      permissions: { createMeetings: true },
    }),
  ).rejects.toThrow("always has every permission");
  await owner.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: adaMember,
    roleId: role("Owner"),
  });
});

test("role managers can't grant permissions they don't hold", async () => {
  const { owner, bea, orgId, beaMember } = await setup();
  const managerRole = await owner.asUser.mutation(api.api.roles.create, {
    orgId,
    name: "People",
    permissions: { manageRoles: true },
  });
  await owner.asUser.mutation(api.api.members.setRole, {
    orgId,
    memberId: beaMember,
    roleId: managerRole,
  });
  await expect(
    bea.asUser.mutation(api.api.roles.create, {
      orgId,
      name: "Boss",
      permissions: { removeMembers: true },
    }),
  ).rejects.toThrow("don't have");
  await expect(
    bea.asUser.mutation(api.api.roles.update, {
      orgId,
      roleId: managerRole,
      permissions: { manageRoles: true, manageOrganization: true },
    }),
  ).rejects.toThrow("don't have");
});

test("invite links respect max uses, revocation and expiry, and are audited", async () => {
  vi.useFakeTimers();
  const { t, owner, orgId, role } = await setup();
  const carl = await signIn(t, "Carl");
  const dee = await signIn(t, "Dee");
  const secret = await owner.asUser.mutation(api.api.joinLinks.create, {
    orgId,
    roleId: role("Member"),
    days: 1,
    maxUses: 1,
  });
  expect(await t.query(api.api.joinLinks.preview, { secret })).toEqual({
    orgName: "Acme",
    roleName: "Member",
  });
  await carl.asUser.mutation(api.api.joinLinks.accept, { secret });
  await expect(dee.asUser.mutation(api.api.joinLinks.accept, { secret })).rejects.toThrow(
    "used up",
  );

  const second = await owner.asUser.mutation(api.api.joinLinks.create, {
    orgId,
    roleId: role("Member"),
    days: 1,
  });
  const links = await owner.asUser.query(api.api.joinLinks.list, { orgId, paginationOpts: page });
  await owner.asUser.mutation(api.api.joinLinks.revoke, { orgId, linkId: links.page[0]!._id });
  await expect(dee.asUser.mutation(api.api.joinLinks.accept, { secret: second })).rejects.toThrow(
    "turned off",
  );

  const third = await owner.asUser.mutation(api.api.joinLinks.create, {
    orgId,
    roleId: role("Member"),
    days: 1,
  });
  vi.advanceTimersByTime(25 * 60 * 60 * 1000);
  await expect(dee.asUser.mutation(api.api.joinLinks.accept, { secret: third })).rejects.toThrow(
    "expired",
  );

  const audit = await owner.asUser.query(api.api.audit.list, { orgId, paginationOpts: page });
  expect(audit.page.map((e) => e.action)).toEqual([
    "joinLinkCreated",
    "joinLinkRevoked",
    "joinLinkCreated",
    "memberJoined",
    "joinLinkCreated",
  ]);
});

test("members can't create links for roles above them or read the audit log", async () => {
  const { bea, orgId, role } = await setup();
  await expect(
    bea.asUser.mutation(api.api.joinLinks.create, { orgId, roleId: role("Member"), days: 7 }),
  ).rejects.toThrow("Not allowed");
  await expect(
    bea.asUser.query(api.api.audit.list, { orgId, paginationOpts: page }),
  ).rejects.toThrow("Not allowed");
});

test("domain join needs a verified email on a private domain, and is explicit", async () => {
  const { t, owner, orgId } = await setup();
  const erin = await signIn(t, "Erin");
  await expect(
    owner.asUser.mutation(api.api.orgs.setJoinDomain, { orgId, domain: "acme.com" }),
  ).rejects.toThrow("verified email must be at acme.com");
  await t.run(async (ctx) => {
    await ctx.db.patch("users", owner.userId, { email: "owner@gmail.com", isVerified: true });
  });
  await expect(
    owner.asUser.mutation(api.api.orgs.setJoinDomain, { orgId, domain: "gmail.com" }),
  ).rejects.toThrow("public email provider");
  await t.run(async (ctx) => {
    await ctx.db.patch("users", owner.userId, { email: "owner@acme.com" });
    await ctx.db.patch("users", erin.userId, { email: "erin@acme.com", isVerified: true });
  });
  await owner.asUser.mutation(api.api.orgs.setJoinDomain, { orgId, domain: "ACME.com" });
  expect(await erin.asUser.query(api.api.orgs.joinable, {})).toEqual([
    { _id: orgId, name: "Acme", domain: "acme.com" },
  ]);
  await erin.asUser.mutation(api.api.orgs.joinWithDomain, { orgId });
  expect(await erin.asUser.query(api.api.orgs.joinable, {})).toEqual([]);
  const members = await owner.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  expect(members.page.find((m) => m.userId === erin.userId)?.roles.map((r) => r.name)).toEqual([
    "Member",
  ]);
});

test("bulk invites skip people who are already members and rate limit bursts", async () => {
  vi.useFakeTimers();
  const { t, owner, bea, orgId, role } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch("users", bea.userId, { email: "bea@acme.com", isVerified: true });
  });
  const result = await owner.asUser.mutation(api.api.invites.create, {
    orgId,
    roleId: role("Member"),
    emails: ["bea@acme.com", " New@Acme.com ", "new@acme.com"],
  });
  expect(result).toEqual({ sent: ["new@acme.com"], skipped: ["bea@acme.com"] });
  const many = Array.from({ length: 50 }, (_, i) => `person${i}@acme.com`);
  await expect(
    owner.asUser.mutation(api.api.invites.create, { orgId, roleId: role("Member"), emails: many }),
  ).rejects.toThrow("Too many tries");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test("people see and end their own sessions; only owners sign others out", async () => {
  const { owner, ada, bea, orgId, beaMember } = await setup();
  const sessions = await bea.asUser.query(api.api.users.sessions, {});
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.current).toBe(true);
  await expect(
    ada.asUser.mutation(api.api.members.signOutEverywhere, { orgId, memberId: beaMember }),
  ).rejects.toThrow("Only owners");
  await owner.asUser.mutation(api.api.members.signOutEverywhere, { orgId, memberId: beaMember });
  await expect(bea.asUser.query(api.api.users.sessions, {})).rejects.toThrow("Unauthenticated");
  expect(await ada.asUser.mutation(api.api.users.signOutEverywhere, {})).toBe(1);
});
