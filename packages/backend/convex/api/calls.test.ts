import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

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

const setup = async (extra: { protected?: boolean } = {}) => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const guest = await signIn(t, "Guest");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const roles = await host.asUser.query(api.api.orgs.roles, { orgId, paginationOpts: page });
  const memberRole = roles.page.find((r) => r.name === "Member")!._id;
  const orgMemberId = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("members", { orgId, userId: guest.userId });
    await ctx.db.insert("memberRoles", { orgId, memberId, roleId: memberRole });
    return memberId;
  });
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
  const event = (name: string, participant?: string, peerId = participant) =>
    t.mutation(internal.internal.realtime.recordEvent, {
      event: {
        event: name,
        meeting: {
          id: "rtk-meeting",
          sessionId: "session-1",
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
