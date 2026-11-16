import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import { allPresets } from "../lib/presets";
import { importPublicKey, isSignedBy } from "../lib/webhooks";

const page = { numItems: 20, cursor: null };
const HOUR = 3_600_000;
const startsAt = Date.UTC(2026, 10, 18, 9, 0);

const requests: { url: string; method: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  requests.length = 0;
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubEnv("REALTIMEKIT_APP_ID", "app");
  vi.stubEnv("REALTIMEKIT_API_TOKEN", "rtk-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      requests.push({ url, method: init.method ?? "GET", body });
      const data = url.endsWith("/meetings")
        ? { id: "rtk-meeting" }
        : url.endsWith("/token")
          ? { token: `refreshed-${requests.length}` }
          : { id: `participant-${requests.length}`, token: `token-${requests.length}` };
      return new Response(JSON.stringify({ success: true, data }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const orgWithTwoPeople = async () => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const guest = await signIn(t, "Guest");
  const outsider = await signIn(t, "Outsider");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await t.run(async (ctx) => {
    await ctx.db.insert("members", { orgId, userId: guest.userId });
  });
  return { t, host, guest, outsider, orgId };
};

const schedule = (
  setup: Awaited<ReturnType<typeof orgWithTwoPeople>>,
  overrides: Partial<{
    kind: "groupCall" | "webinar" | "classroom" | "audioRoom";
    startsAt: number;
    minutes: number;
  }> = {},
) =>
  setup.host.asUser.mutation(api.api.meetings.create, {
    orgId: setup.orgId,
    title: "Planning",
    kind: overrides.kind ?? "webinar",
    recap: true,
    startsAt: overrides.startsAt ?? startsAt,
    minutes: overrides.minutes ?? 30,
    timeZone: "Europe/Berlin",
    inviteeIds: [setup.guest.userId],
  });

test("a scheduled meeting shows up for the host and the invitee", async () => {
  const setup = await orgWithTwoPeople();
  const meetingId = await schedule(setup);
  const hostView = await setup.host.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  const guestView = await setup.guest.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  expect(hostView.page).toMatchObject([{ _id: meetingId, role: "host", response: "accepted" }]);
  expect(guestView.page).toMatchObject([
    {
      _id: meetingId,
      role: "participant",
      response: "pending",
      startsAt,
      endsAt: startsAt + HOUR / 2,
    },
  ]);
  const meeting = await setup.guest.asUser.query(api.api.meetings.get, { meetingId });
  expect(meeting.time).toMatchObject({ start: "10:00", end: "10:30", timeZone: "Europe/Berlin" });
});

test("only org members can be invited, and meetings end on the day they start", async () => {
  const setup = await orgWithTwoPeople();
  await expect(
    setup.host.asUser.mutation(api.api.meetings.create, {
      orgId: setup.orgId,
      title: "Planning",
      kind: "groupCall",
      recap: false,
      startsAt,
      minutes: 30,
      timeZone: "Europe/Berlin",
      inviteeIds: [setup.outsider.userId],
    }),
  ).rejects.toThrow("Only members of this organization");
  await expect(
    schedule(setup, { startsAt: Date.UTC(2026, 10, 18, 22, 30), minutes: 60 }),
  ).rejects.toThrow("end on the day it starts");
});

test("joining creates the call once, uses the attendee preset, then refreshes the token", async () => {
  const setup = await orgWithTwoPeople();
  const meetingId = await schedule(setup, { kind: "webinar" });

  const first = await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(first.token).toMatch(/^token-/);
  expect(requests.map((r) => `${r.method} ${r.url.split("/kit/app")[1]}`)).toEqual([
    "POST /meetings",
    "POST /meetings/rtk-meeting/participants",
  ]);
  expect(requests[0]?.body).toMatchObject({ transcribe_on_end: true, summarize_on_end: true });
  expect(requests[1]?.body).toMatchObject({ preset_name: "webinar_attendee", name: "Guest" });

  const again = await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(again.token).toMatch(/^refreshed-/);
  expect(requests).toHaveLength(3);

  await setup.host.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "webinar_host" });
  expect(requests.filter((r) => r.url.endsWith("/meetings"))).toHaveLength(1);
});

test("people who weren't invited can't join", async () => {
  const setup = await orgWithTwoPeople();
  const meetingId = await schedule(setup);
  await expect(setup.outsider.asUser.action(api.api.meetings.join, { meetingId })).rejects.toThrow(
    "not invited",
  );
  expect(requests).toHaveLength(0);
});

test("busy times cover everyone who hasn't declined", async () => {
  const setup = await orgWithTwoPeople();
  const meetingId = await schedule(setup);
  const busy = await setup.host.asUser.query(api.api.meetings.busy, {
    orgId: setup.orgId,
    from: startsAt - HOUR,
    to: startsAt + HOUR,
  });
  expect(busy[setup.guest.userId]).toEqual([{ start: startsAt, end: startsAt + HOUR / 2 }]);
  await setup.guest.asUser.mutation(api.api.meetings.respond, { meetingId, response: "declined" });
  const after = await setup.host.asUser.query(api.api.meetings.busy, {
    orgId: setup.orgId,
    from: startsAt - HOUR,
    to: startsAt + HOUR,
  });
  expect(after[setup.guest.userId]).toEqual([]);
});

test("presets keep chat in Convex and audio rooms voice-only", () => {
  const presets = allPresets();
  expect(new Set(presets.map((p) => p.name)).size).toBe(8);
  expect(presets.every((p) => !p.permissions.chat.public.can_send)).toBe(true);
  const listener = presets.find((p) => p.name === "audio_listener");
  expect(listener?.config.view_type).toBe("AUDIO_ROOM");
  expect(listener?.permissions.media.video.can_produce).toBe("NOT_ALLOWED");
  expect(
    presets.find((p) => p.name === "class_instructor")?.permissions.connected_meetings,
  ).toMatchObject({ can_alter_connected_meetings: true });
});

test("webhook signatures are checked against the raw body", async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
  const key = await importPublicKey(pem);
  const body = JSON.stringify({ event: "meeting.started" });
  const signed = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(body)),
  );
  const signature = btoa(String.fromCharCode(...signed));
  expect(await isSignedBy(key, body, signature)).toBe(true);
  expect(await isSignedBy(key, `${body} `, signature)).toBe(false);
  expect(await isSignedBy(key, body, "not-base64!")).toBe(false);
});

test("webhook events record one session with each attendee once", async () => {
  const setup = await orgWithTwoPeople();
  const meetingId = await schedule(setup);
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  const meeting = { id: "rtk-meeting", sessionId: "session-1", startedAt: "2026-11-18T09:00:00Z" };
  const record = (event: Record<string, unknown>) =>
    setup.t.mutation(internal.internal.realtime.recordEvent, { event: { meeting, ...event } });
  await record({ event: "meeting.started" });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "a" } });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "a" } });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "b" } });
  await record({
    event: "meeting.ended",
    meeting: { ...meeting, endedAt: "2026-11-18T09:30:00Z" },
  });
  await record({ event: "meeting.summary", summary: "We agreed on the plan." });

  const view = await setup.host.asUser.query(api.api.meetings.get, { meetingId });
  expect(view.sessions).toMatchObject([
    {
      attendees: 2,
      startedAt: Date.UTC(2026, 10, 18, 9, 0),
      endedAt: Date.UTC(2026, 10, 18, 9, 30),
      summary: "We agreed on the plan.",
    },
  ]);
});
