import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";
import { DEFAULT_SETTINGS } from "../models/settings";

const requests: { url: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  requests.length = 0;
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubEnv("REALTIMEKIT_APP_ID", "app");
  vi.stubEnv("REALTIMEKIT_API_TOKEN", "rtk-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, body: init.body ? JSON.parse(init.body as string) : {} });
      const data = url.endsWith("/meetings")
        ? { id: "rtk-meeting" }
        : { id: "participant", token: "token" };
      return new Response(JSON.stringify({ success: true, data }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const setup = async () => {
  const t = testBackend();
  const owner = await signIn(t, "Owner");
  const member = await signIn(t, "Member");
  const orgId = await owner.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, member.userId, "Member");
  return { t, owner, member, orgId };
};

const schedule = (
  as: Awaited<ReturnType<typeof setup>>["owner"],
  orgId: Awaited<ReturnType<typeof setup>>["orgId"],
  inviteeIds: Awaited<ReturnType<typeof setup>>["owner"]["userId"][],
) =>
  as.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Sync",
    kind: "groupCall",
    recap: false,
    startsAt: Date.UTC(2026, 10, 18, 9, 0),
    minutes: 30,
    timeZone: "UTC",
    inviteeIds,
  });

test("settings start from defaults and save only what changed", async () => {
  const { member } = await setup();
  expect(await member.asUser.query(api.api.settings.getMine, {})).toEqual(DEFAULT_SETTINGS);
  await member.asUser.mutation(api.api.settings.setMine, { theme: "dark", joinMuted: true });
  expect(await member.asUser.query(api.api.settings.getMine, {})).toEqual({
    ...DEFAULT_SETTINGS,
    theme: "dark",
    joinMuted: true,
  });
  await expect(
    member.asUser.mutation(api.api.settings.setMine, { defaultMinutes: 1 }),
  ).rejects.toThrow();
});

test("people who only accept organizers can't be invited by regular members", async () => {
  const { owner, member, orgId } = await setup();
  await owner.asUser.mutation(api.api.settings.setMine, { invitesFrom: "managers" });
  await expect(schedule(member, orgId, [owner.userId])).rejects.toThrow(
    "only accepts invites from organizers",
  );
  await member.asUser.mutation(api.api.settings.setMine, { invitesFrom: "managers" });
  await expect(schedule(owner, orgId, [member.userId])).resolves.toMatchObject({
    code: expect.any(String),
  });
});

test("hosts who record automatically start RealtimeKit with recording on", async () => {
  const { owner, orgId } = await setup();
  await owner.asUser.mutation(api.api.settings.setMine, { autoRecord: true });
  const { meetingId } = await schedule(owner, orgId, []);
  await owner.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests[0]?.body).toMatchObject({ record_on_start: true });
});

test("names are trimmed and can't be empty", async () => {
  const { member } = await setup();
  await member.asUser.mutation(api.api.users.updateName, { name: "  Bea  " });
  expect(await member.asUser.query(api.api.users.viewer, {})).toMatchObject({ name: "Bea" });
  await expect(member.asUser.mutation(api.api.users.updateName, { name: "  " })).rejects.toThrow();
});
