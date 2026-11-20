import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import { allPresets } from "../lib/presets";
import { FOREVER } from "../lib/recurrence";
import { importPublicKey, isSignedBy } from "../lib/webhooks";

const page = { numItems: 20, cursor: null };
const HOUR = 3_600_000;
const startsAt = Date.UTC(2026, 10, 18, 9, 0);

const requests: { url: string; method: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const orgWithTwoPeople = async () => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const guest = await signIn(t, "Guest");
  const outsider = await signIn(t, "Outsider");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, guest.userId);
  return { t, host, guest, outsider, orgId };
};

const schedule = (
  setup: Awaited<ReturnType<typeof orgWithTwoPeople>>,
  overrides: Partial<{
    kind: "groupCall" | "webinar" | "classroom" | "audioRoom";
    startsAt: number;
    minutes: number;
    rrule: string;
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
    rrule: overrides.rrule,
  });

test("a scheduled meeting shows up for the host and the invitee", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup);
  const hostView = await setup.host.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  const guestView = await setup.guest.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  expect(code).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  expect(hostView.page).toMatchObject([
    { _id: meetingId, code, role: "host", response: "accepted" },
  ]);
  expect(guestView.page).toMatchObject([
    {
      _id: meetingId,
      role: "participant",
      response: "pending",
      startsAt,
      endsAt: startsAt + HOUR / 2,
    },
  ]);
  const meeting = await setup.guest.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.time).toMatchObject({ start: "10:00", end: "10:30", timeZone: "Europe/Berlin" });
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

test("the host moves and edits a meeting, and invitees are asked again", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup);
  await setup.guest.asUser.mutation(api.api.meetings.respond, { meetingId, response: "accepted" });
  const later = startsAt + 2 * HOUR;
  await expect(
    setup.guest.asUser.mutation(api.api.meetings.reschedule, {
      meetingId,
      startsAt: later,
      minutes: 45,
    }),
  ).rejects.toThrow("Only the host");
  await setup.host.asUser.mutation(api.api.meetings.reschedule, {
    meetingId,
    startsAt: later,
    minutes: 45,
  });
  const guestView = await setup.guest.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  expect(guestView.page).toMatchObject([
    { _id: meetingId, response: "pending", startsAt: later, endsAt: later + 45 * 60_000 },
  ]);
  const inbox = await setup.guest.asUser.query(api.api.inbox.list, { paginationOpts: page });
  expect(inbox.page.map((n) => n.kind)).toContain("meetingMoved");
  await expect(
    setup.guest.asUser.mutation(api.api.meetings.edit, { meetingId, title: "Mine now" }),
  ).rejects.toThrow("Only the host");
  await setup.host.asUser.mutation(api.api.meetings.edit, {
    meetingId,
    title: "Retro ",
    description: "Bring notes",
    location: "Room 4",
  });
  await setup.host.asUser.mutation(api.api.meetings.edit, { meetingId, location: "" });
  const edited = await setup.guest.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  expect(edited.page).toMatchObject([
    { _id: meetingId, title: "Retro ", description: "Bring notes", location: null },
  ]);
  expect(await setup.guest.asUser.query(api.api.meetings.get, { code })).toMatchObject({
    title: "Retro ",
    description: "Bring notes",
    location: null,
  });
  await expect(
    setup.host.asUser.mutation(api.api.meetings.edit, { meetingId, title: "  " }),
  ).rejects.toThrow("Give the meeting a title");
  const repeating = await schedule(setup, { rrule: "FREQ=WEEKLY" });
  await expect(
    setup.host.asUser.mutation(api.api.meetings.reschedule, {
      meetingId: repeating.meetingId,
      startsAt: later,
      minutes: 30,
    }),
  ).rejects.toThrow("Repeating meetings");
});

test("the host can make a one-off meeting repeat and remove an invitee", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup);
  await setup.host.asUser.mutation(api.api.meetings.repeat, { meetingId, rrule: "FREQ=WEEKLY" });
  const meeting = await setup.host.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.time?.rrule).toBe("FREQ=WEEKLY");
  const guestMember = meeting?.people.find((p) => p.role === "participant");
  await expect(
    setup.guest.asUser.mutation(api.api.meetings.uninvite, {
      meetingId,
      memberId: guestMember!._id,
    }),
  ).rejects.toThrow("Only the host");
  await setup.host.asUser.mutation(api.api.meetings.uninvite, {
    meetingId,
    memberId: guestMember!._id,
  });
  const guestView = await setup.guest.asUser.query(api.api.meetings.mine, { paginationOpts: page });
  expect(guestView.page).toEqual([]);
});

test("joining creates the call once, uses the attendee preset, then refreshes the token", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup, { kind: "webinar" });

  const first = await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(first).toMatchObject({ agent: false, token: expect.stringMatching(/^token-/) });
  expect(requests.map((r) => `${r.method} ${r.url.split("/kit/app")[1]}`)).toEqual([
    "POST /meetings",
    "POST /meetings/rtk-meeting/participants",
  ]);
  expect(requests[0]?.body).toMatchObject({ transcribe_on_end: true, summarize_on_end: true });
  expect(requests[1]?.body).toMatchObject({ preset_name: "webinar_attendee", name: "Guest" });

  const again = await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(again).toMatchObject({ agent: false, token: expect.stringMatching(/^refreshed-/) });
  await setup.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(requests.slice(2).map((r) => `${r.method} ${r.url.split("/kit/app")[1]}`)).toEqual([
    "POST /meetings/rtk-meeting/participants/participant-2/token",
    "PATCH /meetings/rtk-meeting",
  ]);
  expect(requests[3]?.body).toMatchObject({
    transcribe_on_end: true,
    recording_config: { max_seconds: 5400 },
  });

  await setup.host.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "webinar_host" });
  expect(requests.filter((r) => r.url.endsWith("/meetings"))).toHaveLength(1);
});

test("joining doesn't wait on updating the call's settings", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup, { kind: "groupCall" });
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) =>
      init.method === "PATCH"
        ? new Response("{}", { status: 504 })
        : new Response(JSON.stringify({ success: true, data: { token: `refreshed-${url}` } })),
    ),
  );
  expect(await setup.guest.asUser.action(api.api.meetings.join, { meetingId })).toMatchObject({
    token: expect.stringMatching(/^refreshed-/),
  });
});

test("watching joins without mic or camera, and switching modes adds a fresh participant", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup, { kind: "groupCall" });

  await setup.guest.asUser.action(api.api.meetings.join, { meetingId, watch: true });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "call_public_guest", name: "Guest" });

  await setup.guest.asUser.action(api.api.meetings.join, { meetingId, watch: true });
  expect(requests.at(-1)?.url).toMatch(/\/token$/);

  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "call_participant" });
});

test("turning live transcript off joins people with a preset that doesn't transcribe", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup, { kind: "groupCall" });
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });

  await setup.host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, liveText: false });
  expect(await setup.host.asUser.query(api.api.meetings.get, { code })).toMatchObject({
    liveText: false,
  });
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "call_participant_no_text" });

  await setup.host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, liveText: true });
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "call_participant" });
});

test("an AI agent never takes a call seat, and shows with its app icon", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup, { kind: "groupCall" });
  await setup.host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const guest = await setup.t.mutation(api.api.guests.enter, { code, name: "Sara's assistant" });
  const claudeBrowser =
    "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Claude/5.11492.5 Chrome/156.0 Safari/537.36";

  expect(
    await setup.t.action(api.api.meetings.join, { meetingId, guest, userAgent: claudeBrowser }),
  ).toEqual({ agent: true });
  expect(await setup.t.action(api.api.meetings.join, { meetingId, guest })).toEqual({
    agent: true,
  });
  expect(requests).toHaveLength(0);

  expect(await setup.t.query(api.api.meetings.get, { code, guest })).toMatchObject({
    me: { agent: "claude" },
  });
  const meeting = await setup.host.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.people.find((person) => person.isGuest)).toMatchObject({
    agent: "claude",
    imageUrl: expect.stringContaining("/256x256bb.png"),
  });
});

test("signed-in people are never taken for agents", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup, { kind: "groupCall" });
  const joined = await setup.guest.asUser.action(api.api.meetings.join, {
    meetingId,
    userAgent: "Mozilla/5.0 Claude/5.1 Chrome/156.0",
  });
  expect(joined).toMatchObject({ agent: false, viewer: false });
  expect(requests.at(-1)?.body).toMatchObject({ preset_name: "call_participant" });
});

test("people who weren't invited can't join", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup);
  await expect(setup.outsider.asUser.action(api.api.meetings.join, { meetingId })).rejects.toThrow(
    "not invited",
  );
  expect(requests).toHaveLength(0);
});

test("busy times cover everyone who hasn't declined", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId } = await schedule(setup);
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

test("busy times include later occurrences of a repeating meeting", async () => {
  const setup = await orgWithTwoPeople();
  await schedule(setup, { rrule: "FREQ=WEEKLY;BYDAY=WE" });
  const time = await setup.t.run((ctx) => ctx.db.query("meetingTimes").first());
  expect(time).toMatchObject({ orgId: setup.orgId, repeatUntil: FOREVER });
  const nextWeek = startsAt + 7 * 24 * HOUR;
  const busy = await setup.host.asUser.query(api.api.meetings.busy, {
    orgId: setup.orgId,
    from: nextWeek - HOUR,
    to: nextWeek + HOUR,
  });
  expect(busy[setup.guest.userId]).toEqual([{ start: nextWeek, end: nextWeek + HOUR / 2 }]);
  expect(busy[setup.host.userId]).toEqual([{ start: nextWeek, end: nextWeek + HOUR / 2 }]);
  expect(busy[setup.outsider.userId]).toBeUndefined();
});

test("presets keep chat in Convex and audio rooms voice-only", () => {
  const presets = allPresets();
  expect(new Set(presets.map((p) => p.name)).size).toBe(18);
  expect(presets.every((p) => !p.permissions.chat.public.can_send)).toBe(true);
  expect(
    presets.every((p) => p.permissions.transcription_enabled === !p.name.endsWith("_no_text")),
  ).toBe(true);
  const listener = presets.find((p) => p.name === "audio_listener");
  expect(listener?.config.view_type).toBe("AUDIO_ROOM");
  expect(listener?.permissions.media.video.can_produce).toBe("NOT_ALLOWED");
  expect(
    presets.find((p) => p.name === "class_instructor")?.permissions.connected_meetings,
  ).toMatchObject({ can_alter_connected_meetings: true });
  expect(presets.find((p) => p.name === "call_public_guest")?.permissions.media).toEqual({
    audio: { can_produce: "NOT_ALLOWED" },
    video: { can_produce: "NOT_ALLOWED" },
    screenshare: { can_produce: "NOT_ALLOWED" },
  });
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

test("webhook events record one session with everyone who joined or left, once each", async () => {
  const setup = await orgWithTwoPeople();
  const { meetingId, code } = await schedule(setup);
  await setup.guest.asUser.action(api.api.meetings.join, { meetingId });
  const meeting = { id: "rtk-meeting", sessionId: "session-1", startedAt: "2026-11-18T09:00:00Z" };
  const record = (event: Record<string, unknown>) =>
    setup.t.mutation(internal.internal.realtime.recordEvent, { event: { meeting, ...event } });
  await record({ event: "meeting.started" });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "a" } });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "a" } });
  await record({ event: "meeting.participantJoined", participant: { customParticipantId: "b" } });
  await record({ event: "meeting.participantLeft", participant: { customParticipantId: "host" } });
  await record({
    event: "meeting.ended",
    meeting: { ...meeting, endedAt: "2026-11-18T09:30:00Z" },
  });
  await record({ event: "meeting.summary", summary: "We agreed on the plan." });

  const view = await setup.host.asUser.query(api.api.meetings.get, { code });
  expect(view?.sessions).toMatchObject([
    {
      attendees: 3,
      startedAt: Date.UTC(2026, 10, 18, 9, 0),
      endedAt: Date.UTC(2026, 10, 18, 9, 30),
      summary: "We agreed on the plan.",
    },
  ]);
});
