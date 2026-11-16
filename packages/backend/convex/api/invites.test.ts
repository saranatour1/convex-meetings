import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";
import { INVITE_TTL_MS } from "../models/invites";

const sentEmails: { to: string; text: string }[] = [];

const cloudflareAccepts = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { to: string; text: string };
      sentEmails.push(body);
      return new Response(
        JSON.stringify({ success: true, result: { message_id: "<m@test>", delivered: [body.to] } }),
      );
    }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  sentEmails.length = 0;
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "test-account");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-token");
  vi.stubEnv("EMAIL_FROM", "invites@example.com");
  cloudflareAccepts();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const page = { numItems: 20, cursor: null };

const orgWithOwner = async () => {
  const t = testBackend();
  const owner = await signIn(t, "Owner");
  const orgId = await owner.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const roles = await owner.asUser.query(api.api.orgs.roles, { orgId, paginationOpts: page });
  const roleId = (name: string) => roles.page.find((role) => role.name === name)!._id;
  return { t, owner, orgId, ownerRoleId: roleId("Owner"), memberRoleId: roleId("Member") };
};

const sendInvite = async (setup: Awaited<ReturnType<typeof orgWithOwner>>, email: string) => {
  await setup.owner.asUser.mutation(api.api.invites.create, {
    orgId: setup.orgId,
    email,
    roleId: setup.memberRoleId,
  });
  await setup.t.finishAllScheduledFunctions(vi.runAllTimers);
  const link = sentEmails.at(-1)?.text.match(/\/invite\/([0-9a-f]{64})/);
  return link?.[1] ?? "";
};

test("creating an organization makes the creator its owner", async () => {
  const { owner, orgId } = await orgWithOwner();
  const mine = await owner.asUser.query(api.api.orgs.listMine, { paginationOpts: page });
  expect(mine.page).toEqual([{ _id: orgId, name: "Acme" }]);
  const members = await owner.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  expect(members.page[0]?.roles).toEqual(["Owner"]);
});

test("an invite emails a link whose secret is stored only as a hash", async () => {
  const setup = await orgWithOwner();
  const secret = await sendInvite(setup, "  Bea@Example.com ");
  expect(secret).toHaveLength(64);
  expect(sentEmails[0]?.to).toBe("bea@example.com");
  const tokens = await setup.t.run((ctx) => ctx.db.query("tokens").collect());
  expect(tokens).toHaveLength(1);
  expect(tokens[0]?.value).not.toBe(secret);
  expect(await setup.t.query(api.api.invites.preview, { secret })).toEqual({
    orgName: "Acme",
    inviterName: "Owner",
    email: "bea@example.com",
  });
});

test("accepting an invite adds a verified member and uses up the link", async () => {
  const setup = await orgWithOwner();
  const secret = await sendInvite(setup, "bea@example.com");
  const bea = await signIn(setup.t, "Bea");
  expect(await bea.asUser.mutation(api.api.invites.accept, { secret })).toBe(setup.orgId);

  const members = await setup.owner.asUser.query(api.api.members.list, {
    orgId: setup.orgId,
    paginationOpts: page,
  });
  expect(members.page.find((m) => m.userId === bea.userId)).toMatchObject({
    email: "bea@example.com",
    isVerified: true,
    roles: ["Member"],
  });
  expect(await setup.t.run((ctx) => ctx.db.query("invites").collect())).toEqual([]);
  await expect(bea.asUser.mutation(api.api.invites.accept, { secret })).rejects.toThrow(
    "expired or was already used",
  );
});

test("an expired invite can't be previewed or accepted", async () => {
  const setup = await orgWithOwner();
  const secret = await sendInvite(setup, "late@example.com");
  vi.setSystemTime(Date.now() + INVITE_TTL_MS + 1);
  expect(await setup.t.query(api.api.invites.preview, { secret })).toBeNull();
  const late = await signIn(setup.t, "Late");
  await expect(late.asUser.mutation(api.api.invites.accept, { secret })).rejects.toThrow(
    "expired or was already used",
  );
});

test("members without the invite permission can't invite", async () => {
  const setup = await orgWithOwner();
  const secret = await sendInvite(setup, "bea@example.com");
  const bea = await signIn(setup.t, "Bea");
  await bea.asUser.mutation(api.api.invites.accept, { secret });
  await expect(
    bea.asUser.mutation(api.api.invites.create, {
      orgId: setup.orgId,
      email: "friend@example.com",
      roleId: setup.memberRoleId,
    }),
  ).rejects.toThrow("Not allowed");
});

test("a refused email is shown on the invite", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 10202, message: "email.sending.error.email.invalid" }],
          }),
          { status: 400 },
        ),
    ),
  );
  const setup = await orgWithOwner();
  await sendInvite(setup, "bea@example.com");
  const invites = await setup.owner.asUser.query(api.api.invites.list, {
    orgId: setup.orgId,
    paginationOpts: page,
  });
  expect(invites.page[0]?.emailError).toMatch("10202");
});

test("the last owner can't be removed", async () => {
  const { owner, orgId } = await orgWithOwner();
  const members = await owner.asUser.query(api.api.members.list, { orgId, paginationOpts: page });
  await expect(
    owner.asUser.mutation(api.api.members.remove, { orgId, memberId: members.page[0]!._id }),
  ).rejects.toThrow("at least one owner");
});
