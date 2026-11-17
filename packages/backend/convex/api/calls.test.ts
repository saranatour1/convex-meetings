import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DateTime } from "luxon";

const page = { numItems: 20, cursor: null };
let calls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubEnv("REALTIMEKIT_APP_ID", "app");
  vi.stubEnv("REALTIMEKIT_API_TOKEN", "rtk-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
      const data = url.endsWith("/meetings")
        ? { id: "rtk-meeting" }
        : url.endsWith("/presets")
          ? [{ id: "preset-1", name: "call_host" }]
          : url.includes("/recordings?")
            ? [{ id: "recording-1" }]
            : { id: "participant", token: "token" };
      return new Response(JSON.stringify({ success: true, data }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const setup = async (extra: { protected?: boolean; rrule?: string } = {}) => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const guest = await signIn(t, "Guest");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const orgMemberId = await addOrgMember(t, orgId, guest.userId, "Member");
  const { meetingId } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Planning",
    kind: "groupCall",
    recap: true,
    startsAt: Date.UTC(2026, 10, 18, 9, 0),
    minutes: 30,
    timeZone: "UTC",
    inviteeIds: [guest.userId],
    ...extra,
  });
  const memberOf = (userId: Id<"users">) =>
    t.run(
      async (ctx) =>
        (await ctx.db
          .query("meetingMembers")
          .withIndex("by_meeting_and_user", (q) =>
            q.eq("meetingId", meetingId).eq("userId", userId),
          )
          .unique())!._id,
    );
  const guestMember = await memberOf(guest.userId);
  const hostMember = await memberOf(host.userId);
  const event = (
    name: string,
    participant?: string,
    peerId = participant,
    sessionId = "session-1",
  ) =>
    t.mutation(internal.internal.realtime.recordEvent, {
      event: {
        event: name,
        meeting: {
          id: "rtk-meeting",
          sessionId,
          startedAt: new Date(Date.now() - 1000).toISOString(),
        },
        participant: participant ? { customParticipantId: participant, peerId } : undefined,
      },
    });
  return { t, host, guest, orgId, orgMemberId, meetingId, guestMember, hostMember, event };
};

test("a removed person is kicked and can't rejoin until let back in", async () => {
  vi.useFakeTimers();
  const { t, host, guest, meetingId, guestMember } = await setup();
  await guest.asUser.action(api.api.meetings.join, { meetingId });
  await expect(
    guest.asUser.mutation(api.api.calls.remove, { meetingMemberId: guestMember }),
  ).rejects.toThrow("Only the host");
  await host.asUser.mutation(api.api.calls.remove, { meetingMemberId: guestMember });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls.at(-1)).toMatchObject({
    url: expect.stringContaining("/meetings/rtk-meeting/active-session/kick"),
    body: { participant_ids: ["participant"] },
  });
  await expect(guest.asUser.action(api.api.meetings.join, { meetingId })).rejects.toThrow(
    "removed you",
  );
  await expect(
    guest.asUser.mutation(api.api.messages.send, { meetingId, body: "hi" }),
  ).rejects.toThrow("removed you");
  await host.asUser.mutation(api.api.calls.letIn, { meetingMemberId: guestMember });
  await guest.asUser.action(api.api.meetings.join, { meetingId });
});

test("live calls track who is in, and admins end them for everyone", async () => {
  vi.useFakeTimers();
  const { t, host, orgId, meetingId, guestMember, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  await event("meeting.participantJoined", guestMember);
  await event("meeting.participantLeft", guestMember);
  expect(await host.asUser.query(api.api.calls.live, { orgId })).toMatchObject([
    { title: "Planning", people: ["Host"], count: 1 },
  ]);
  await host.asUser.mutation(api.api.calls.end, { meetingId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls.at(-1)?.url).toContain("/active-session/kick-all");
  await event("meeting.ended");
  expect(await host.asUser.query(api.api.calls.live, { orgId })).toEqual([]);
});

test("removing someone from the org takes them out of its live calls", async () => {
  vi.useFakeTimers();
  const { t, host, guest, orgId, orgMemberId, meetingId, guestMember, event } = await setup();
  await guest.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", guestMember);
  await host.asUser.mutation(api.api.members.remove, { orgId, memberId: orgMemberId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls.at(-1)?.body).toEqual({ participant_ids: ["participant"] });
  const removed = await t.run((ctx) => ctx.db.get("meetingMembers", guestMember));
  expect(removed?.removedAt).toBeTypeOf("number");
});

test("everyone draws on a share; only the presenter or host clears it", async () => {
  const { host, guest, meetingId, hostMember, guestMember } = await setup();
  await guest.asUser.mutation(api.api.annotations.draw, {
    meetingId,
    shareId: hostMember,
    color: "red",
    points: [0.1, 0.1, 0.5, 0.5],
  });
  expect(
    await host.asUser.query(api.api.annotations.strokes, { meetingId, shareId: hostMember }),
  ).toMatchObject([{ color: "red", points: [0.1, 0.1, 0.5, 0.5], memberId: guestMember }]);
  await expect(
    guest.asUser.mutation(api.api.annotations.clear, { meetingId, shareId: hostMember }),
  ).rejects.toThrow("presenter or the host");
  await host.asUser.mutation(api.api.annotations.clear, { meetingId, shareId: hostMember });
  expect(
    await guest.asUser.query(api.api.annotations.strokes, { meetingId, shareId: hostMember }),
  ).toEqual([]);
});

test("protected meetings never record and keep snapshots and downloads to hosts", async () => {
  const { t, host, guest, meetingId, guestMember, hostMember, event } = await setup({
    protected: true,
  });
  await host.asUser.mutation(api.api.settings.setMine, { autoRecord: true });
  await guest.asUser.action(api.api.meetings.join, { meetingId });
  expect(calls.find((c) => c.url.endsWith("/meetings"))?.body).toMatchObject({
    record_on_start: false,
  });
  await expect(
    guest.asUser.mutation(api.api.annotations.snapshotUploadUrl, { meetingId }),
  ).rejects.toThrow("only the host");
  await host.asUser.mutation(api.api.annotations.snapshotUploadUrl, { meetingId });

  await event("meeting.participantJoined", hostMember);
  await guest.asUser.mutation(api.api.messages.send, { meetingId, body: "During the call" });
  await event("meeting.participantJoined", guestMember);
  const sessionId = await t.run(
    async (ctx) => (await ctx.db.query("meetingSessions").first())!._id,
  );
  const code = (await t.run((ctx) => ctx.db.get("meetings", meetingId)))!.code;
  expect(await guest.asUser.query(api.api.meetings.recap, { code, number: 1 })).toMatchObject({
    sessionId,
    canDownload: false,
  });
  expect((await host.asUser.query(api.api.meetings.recap, { code, number: 1 }))?.canDownload).toBe(
    true,
  );
  const chat = await host.asUser.query(api.api.meetings.recapChat, {
    sessionId,
    paginationOpts: page,
  });
  expect(chat.page).toMatchObject([{ body: "During the call", authorName: "Guest" }]);

  await t.run((ctx) =>
    ctx.db.patch("meetingSessions", sessionId, { recordingUrl: "https://cf.example/rec.mp4" }),
  );
  const seen = await guest.asUser.query(api.api.meetings.get, { code });
  expect(seen?.sessions[0]).toMatchObject({ hasRecording: true });
  expect(seen?.sessions[0]).not.toHaveProperty("recordingUrl");
});

test("a live session's recap chat shows messages sent after it was first read", async () => {
  const { t, host, guest, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  const sessionId = await t.run(
    async (ctx) => (await ctx.db.query("meetingSessions").first())!._id,
  );
  const before = await host.asUser.query(api.api.meetings.recapChat, {
    sessionId,
    paginationOpts: page,
  });
  expect(before.page).toEqual([]);
  await guest.asUser.mutation(api.api.messages.send, { meetingId, body: "Still here" });
  const after = await host.asUser.query(api.api.meetings.recapChat, {
    sessionId,
    paginationOpts: page,
  });
  expect(after.page).toMatchObject([{ body: "Still here" }]);
});

test("one person on two devices stays present until both leave, and can switch here", async () => {
  vi.useFakeTimers();
  const { t, host, orgId, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  const code = (await t.run((ctx) => ctx.db.get("meetings", meetingId)))!.code;
  await event("meeting.participantJoined", hostMember, "laptop");
  await event("meeting.participantJoined", hostMember, "phone");
  await event("meeting.participantJoined", hostMember, "phone");
  expect(await host.asUser.query(api.api.calls.live, { orgId })).toMatchObject([
    { people: ["Host"], count: 1 },
  ]);
  expect((await host.asUser.query(api.api.meetings.get, { code }))?.me.devicesInCall).toBe(2);
  await event("meeting.participantLeft", hostMember, "laptop");
  expect(await host.asUser.query(api.api.calls.live, { orgId })).toHaveLength(1);
  expect((await host.asUser.query(api.api.meetings.get, { code }))?.me.devicesInCall).toBe(1);

  await event("meeting.participantJoined", hostMember, "tablet");
  await host.asUser.mutation(api.api.calls.leftOnDevice, { meetingId, peerId: "tablet" });
  expect((await host.asUser.query(api.api.meetings.get, { code }))?.me.devicesInCall).toBe(1);

  await host.asUser.action(api.api.calls.switchHere, { meetingId });
  expect(calls.at(-1)).toMatchObject({
    url: expect.stringContaining("/active-session/kick"),
    body: { participant_ids: ["participant"] },
  });
  expect((await host.asUser.query(api.api.meetings.get, { code }))?.me.devicesInCall).toBe(0);
  expect(await host.asUser.query(api.api.calls.live, { orgId })).toEqual([]);
});

test("an ended call forgets who was in it, even if a join arrives late", async () => {
  const { t, host, meetingId, hostMember, guestMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember, "laptop");
  await event("meeting.participantJoined", guestMember, "phone");
  expect(await t.run((ctx) => ctx.db.query("callPeers").collect())).toHaveLength(2);
  await event("meeting.ended");
  expect(await t.run((ctx) => ctx.db.query("callPeers").collect())).toEqual([]);
  await event("meeting.participantJoined", guestMember, "tablet");
  expect(await t.run((ctx) => ctx.db.query("callPeers").collect())).toEqual([]);
});

test("a new session forgets devices from one that never ended", async () => {
  const { t, host, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  const code = (await t.run((ctx) => ctx.db.get("meetings", meetingId)))!.code;
  await event("meeting.participantJoined", hostMember, "laptop", "session-a");
  await event("meeting.participantJoined", hostMember, "phone", "session-b");
  expect((await host.asUser.query(api.api.meetings.get, { code }))?.me.devicesInCall).toBe(1);
});

const meetingDoc = (t: Awaited<ReturnType<typeof setup>>["t"], meetingId: Id<"meetings">) =>
  t.run((ctx) => ctx.db.get("meetings", meetingId));

test("a meeting ends once its call has been empty for two minutes", async () => {
  vi.useFakeTimers();
  const { t, host, guest, meetingId, hostMember, guestMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  await event("meeting.participantJoined", guestMember);
  await event("meeting.participantLeft", guestMember);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await meetingDoc(t, meetingId))?.endedAt).toBeUndefined();

  await event("meeting.participantLeft", hostMember);
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await meetingDoc(t, meetingId))?.endedAt).toBeTypeOf("number");
  expect(calls.at(-1)).toMatchObject({
    url: expect.stringMatching(/\/meetings\/rtk-meeting$/),
    body: { status: "INACTIVE" },
  });
  await expect(guest.asUser.action(api.api.meetings.join, { meetingId })).rejects.toThrow(
    "This meeting has ended",
  );
});

test("rejoining within two minutes keeps the meeting open", async () => {
  vi.useFakeTimers();
  const { t, host, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember, "peer-1");
  await event("meeting.participantLeft", hostMember, "peer-1");
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantJoined", hostMember, "peer-2");
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await meetingDoc(t, meetingId))?.endedAt).toBeUndefined();
});

test("ending a repeating meeting drops its later occurrences", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 9, 10));
  const { t, host, orgId, meetingId, hostMember, event } = await setup({ rrule: "FREQ=WEEKLY" });
  const weeks = { from: Date.UTC(2026, 10, 18), to: Date.UTC(2026, 11, 16) };
  const busy = async () =>
    (await host.asUser.query(api.api.meetings.busy, { orgId, ...weeks }))[host.userId];
  expect(await busy()).toHaveLength(4);

  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  await event("meeting.participantLeft", hostMember);
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await busy()).toEqual([
    { start: Date.UTC(2026, 10, 18, 9, 0), end: Date.UTC(2026, 10, 18, 9, 30) },
  ]);
});

test("the recap shows when each person joined, left and how long they stayed", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 9, 0));
  const { t, host, meetingId, hostMember, guestMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  const start = Date.now();
  await event("meeting.participantJoined", hostMember, "host-laptop");
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantJoined", guestMember);
  await event("meeting.participantJoined", hostMember, "host-phone");
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantLeft", hostMember, "host-laptop");
  await event("meeting.participantLeft", guestMember);
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantJoined", guestMember);
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantLeft", hostMember, "host-phone");
  await event("meeting.participantLeft", guestMember);
  const code = (await t.run((ctx) => ctx.db.get("meetings", meetingId)))!.code;
  const recap = await host.asUser.query(api.api.meetings.recap, { code, number: 1 });
  const [hostRow, guestRow] = recap!.attendance;
  expect(recap!.attendance.map(({ name, seconds }) => ({ name, seconds }))).toEqual([
    { name: "Host", seconds: 240 },
    { name: "Guest", seconds: 120 },
  ]);
  expect(hostRow!.joinedAt - start).toBeLessThan(10);
  expect(guestRow!.joinedAt - start).toBeCloseTo(60_000, -2);
  expect(guestRow!.leftAt).toBe(hostRow!.leftAt);
});

const month = () => DateTime.utc().toFormat("yyyy-LL");
const usageOf = (t: ReturnType<typeof testBackend>, key: string) =>
  t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("usage")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique()
      )?.amount ?? 0,
  );

test("each person can create 10 meetings a day", async () => {
  const { host, orgId } = await setup();
  const create = () =>
    host.asUser.mutation(api.api.meetings.create, {
      orgId,
      title: "Again",
      kind: "groupCall",
      recap: false,
      startsAt: Date.UTC(2026, 10, 18, 9, 0),
      minutes: 30,
      timeZone: "UTC",
      inviteeIds: [],
    });
  for (let made = 1; made < 10; made++) await create();
  await expect(create()).rejects.toThrow("You can create 10 meetings a day.");
});

test("call minutes count per device and end every call at the monthly limit", async () => {
  vi.useFakeTimers();
  const { t, host, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember, "laptop");
  await event("meeting.participantJoined", hostMember, "phone");
  vi.advanceTimersByTime(60_000);
  await event("meeting.participantLeft", hostMember, "phone");
  expect(await usageOf(t, `callSeconds:${month()}`)).toBeCloseTo(60, 0);

  await t.run(async (ctx) => {
    const row = await ctx.db.query("usage").first();
    await ctx.db.patch("usage", row!._id, { amount: 9_000 * 60 });
  });
  await t.mutation(internal.internal.usage.enforce, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls.some((c) => c.url.endsWith("/active-session/kick-all"))).toBe(true);
  await expect(host.asUser.action(api.api.meetings.join, { meetingId })).rejects.toThrow(
    "free call minutes are used up",
  );
});

test("recording minutes are counted and recordings stop at the monthly limit", async () => {
  vi.useFakeTimers();
  const { t, host, meetingId, hostMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  const recording = (status: string) =>
    t.mutation(internal.internal.realtime.recordEvent, {
      event: {
        event: "recording.statusUpdate",
        meeting: { id: "rtk-meeting", sessionId: "session-1" },
        recording: { status },
      },
    });
  await recording("RECORDING");
  vi.advanceTimersByTime(120_000);
  await recording("UPLOADING");
  await recording("UPLOADED");
  expect(await usageOf(t, `recordingSeconds:${month()}`)).toBeCloseTo(120, 0);

  await recording("RECORDING");
  vi.advanceTimersByTime(90 * 60_000);
  await t.mutation(internal.internal.usage.enforce, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls).toContainEqual({
    url: expect.stringContaining("/recordings/recording-1"),
    body: { action: "stop" },
  });
  await host.asUser.action(api.api.meetings.join, { meetingId });
  expect(calls.at(-2)).toMatchObject({
    url: expect.stringContaining("/meetings/rtk-meeting"),
    body: { record_on_start: false, recording_config: { max_seconds: 60 } },
  });
});

test("live text switches off for the day once its share of free AI usage is spent", async () => {
  vi.useFakeTimers();
  const { t, host, meetingId, hostMember, guestMember, event } = await setup();
  await host.asUser.action(api.api.meetings.join, { meetingId });
  await event("meeting.participantJoined", hostMember);
  vi.advanceTimersByTime(6 * 60_000);
  await t.mutation(internal.internal.usage.enforce, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(calls.at(-1)).toMatchObject({
    url: expect.stringContaining("/presets/preset-1"),
    body: { permissions: { transcription_enabled: false } },
  });
  expect(await usageOf(t, "liveTextOff")).toBe(1);
  await event("meeting.participantJoined", guestMember);
  const peers = await t.run((ctx) => ctx.db.query("callPeers").collect());
  expect(peers.find((peer) => peer.memberId === guestMember)?.liveText).toBe(false);
});
