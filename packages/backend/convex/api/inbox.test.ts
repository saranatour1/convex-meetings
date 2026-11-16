import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";

const page = { numItems: 20, cursor: null };

beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubEnv("REALTIMEKIT_APP_ID", "app");
  vi.stubEnv("REALTIMEKIT_API_TOKEN", "rtk-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
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
  const host = await signIn(t, "Host");
  const guest = await signIn(t, "Guest");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await t.run(async (ctx) => {
    await ctx.db.insert("members", { orgId, userId: guest.userId });
  });
  const { meetingId, code } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Planning",
    kind: "groupCall",
    recap: true,
    startsAt: Date.UTC(2026, 10, 18, 9, 0),
    minutes: 30,
    timeZone: "UTC",
    inviteeIds: [guest.userId],
  });
  return { t, host, guest, orgId, meetingId, code };
};

test("invites, replies and cancellations reach the right inbox", async () => {
  const { host, guest, meetingId, code } = await setup();
  const inbox = await guest.asUser.query(api.api.inbox.list, { paginationOpts: page });
  expect(inbox.page).toMatchObject([
    { kind: "meetingInvite", title: "Planning", meetingCode: code, actorName: "Host" },
  ]);
  expect(await guest.asUser.query(api.api.inbox.unreadCount, {})).toBe(1);
  await guest.asUser.mutation(api.api.inbox.read, { notificationId: inbox.page[0]!._id });
  expect(await guest.asUser.query(api.api.inbox.unreadCount, {})).toBe(0);

  await guest.asUser.mutation(api.api.meetings.respond, { meetingId, response: "accepted" });
  expect(
    (await host.asUser.query(api.api.inbox.list, { paginationOpts: page })).page,
  ).toMatchObject([{ kind: "rsvp", detail: "is going", actorName: "Guest" }]);

  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  expect(
    (await guest.asUser.query(api.api.inbox.list, { paginationOpts: page })).page[0],
  ).toMatchObject({ kind: "meetingCancelled", title: "Planning" });
  expect(await host.asUser.query(api.api.inbox.unreadCount, {})).toBe(1);
  await host.asUser.mutation(api.api.inbox.readAll, {});
  expect(await host.asUser.query(api.api.inbox.unreadCount, {})).toBe(0);
});

test("a finished call becomes a recap with attendees, summary, transcript and recording", async () => {
  const { t, host, guest, meetingId } = await setup();
  await guest.asUser.action(api.api.meetings.join, { meetingId });
  const guestMemberId = await t.run(async (ctx) => {
    const member = await ctx.db
      .query("meetingMembers")
      .withIndex("by_meeting_and_user", (q) =>
        q.eq("meetingId", meetingId).eq("userId", guest.userId),
      )
      .unique();
    return member!._id;
  });
  const transcriptId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["[]"], { type: "application/json" })),
  );
  const meeting = { id: "rtk-meeting", sessionId: "session-1", startedAt: "2026-11-18T09:00:00Z" };
  const record = (event: Record<string, unknown>) =>
    t.mutation(internal.internal.realtime.recordEvent, { event: { meeting, ...event } });
  await record({
    event: "meeting.participantJoined",
    participant: { customParticipantId: guestMemberId },
  });
  await record({ event: "meeting.summary", summary: "We agreed on the plan." });
  await record({ event: "meeting.summary", summary: "We agreed on the plan." });
  await record({ event: "meeting.transcript", transcriptId });
  await record({
    event: "recording.statusUpdate",
    recording: {
      status: "UPLOADED",
      downloadUrl: "https://cf.example/rec.mp4",
      recordingDuration: 90,
    },
    recordingKey: "recordings/rec.mp4",
  });

  const sessionId = (await host.asUser.query(api.api.meetings.mine, { paginationOpts: page }))
    .page[0]!.lastSession!._id;
  const recap = await host.asUser.query(api.api.meetings.recap, { sessionId });
  expect(recap).toMatchObject({
    attendees: ["Guest"],
    summary: "We agreed on the plan.",
    hasRecording: true,
    recordingSeconds: 90,
  });
  expect(recap.transcriptUrl).toBeTruthy();
  const recapNotices = (
    await guest.asUser.query(api.api.inbox.list, { paginationOpts: page })
  ).page.filter((n) => n.kind === "recapReady");
  expect(recapNotices).toHaveLength(1);

  expect(await host.asUser.query(api.api.meetings.recordingUrl, { sessionId })).toBe(
    "https://cf.example/rec.mp4",
  );
  vi.stubEnv("R2_BUCKET", "recordings");
  vi.stubEnv("R2_ENDPOINT", "https://acct.r2.cloudflarestorage.com");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  expect(await host.asUser.query(api.api.meetings.recordingUrl, { sessionId })).toContain(
    "recordings/rec.mp4",
  );
});

test("start now creates an instant meeting you host", async () => {
  const { host, orgId } = await setup();
  const { code } = await host.asUser.mutation(api.api.meetings.startNow, {
    orgId,
    timeZone: "Europe/Berlin",
  });
  const meeting = await host.asUser.query(api.api.meetings.get, { code });
  expect(meeting).toMatchObject({ title: "Instant meeting", me: { role: "host" } });
});
