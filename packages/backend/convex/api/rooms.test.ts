import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const page = { numItems: 20, cursor: null };
const device = "device-0001";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const setup = async () => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const member = await signIn(t, "Member");
  const outsider = await signIn(t, "Outsider");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, member.userId, "Member");
  await t.run((ctx) => ctx.db.patch("users", outsider.userId, { email: "out@example.com" }));
  const { code, meetingId } = await host.asUser.mutation(api.api.rooms.create, {
    orgId,
    title: "Quiet study hall",
    description: "Bring your work and sit with us.",
    slowModeSeconds: 30,
    timeZone: "UTC",
  });
  await t.run((ctx) => ctx.db.patch("meetings", meetingId, { rtkMeetingId: "rtk-meeting" }));
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
  return { t, host, member, outsider, orgId, code, meetingId, memberOf, event };
};

test("only people who manage meetings open public rooms", async () => {
  const { member, orgId } = await setup();
  await expect(
    member.asUser.mutation(api.api.rooms.create, {
      orgId,
      title: "Lounge",
      description: "Hang out.",
      slowModeSeconds: 0,
      timeZone: "UTC",
    }),
  ).rejects.toThrow("Not allowed");
});

test("the directory lists open public rooms to anyone, and nothing else", async () => {
  const { t, host, orgId, code, meetingId } = await setup();
  await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Private planning",
    kind: "groupCall",
    recap: false,
    startsAt: Date.now() + 3_600_000,
    minutes: 15,
    timeZone: "UTC",
    inviteeIds: [],
  });
  const listed = await t.query(api.api.rooms.directory, { paginationOpts: page });
  expect(listed.page).toEqual([
    {
      code,
      title: "Quiet study hall",
      description: "Bring your work and sit with us.",
      people: 0,
      slowModeSeconds: 30,
      waitingRoom: false,
      host: "Acme",
    },
  ]);
  expect(await t.query(api.api.rooms.preview, { code })).toMatchObject({ code, closedAt: null });
  await host.asUser.mutation(api.api.rooms.close, { meetingId });
  expect((await t.query(api.api.rooms.directory, { paginationOpts: page })).page).toEqual([]);
  expect((await t.query(api.api.rooms.preview, { code }))?.closedAt).toBeTypeOf("number");
  expect(
    (await host.asUser.query(api.api.rooms.ours, { orgId, paginationOpts: page })).page,
  ).toHaveLength(1);
});

test("guests and signed-in outsiders walk into a public room until it closes", async () => {
  const { t, host, outsider, code, meetingId } = await setup();
  await expect(t.mutation(api.api.guests.enter, { code, name: "Gus" })).rejects.toThrow(
    "Reload the page",
  );
  const secret = await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  expect(await t.query(api.api.meetings.get, { code, guest: secret })).toMatchObject({
    access: "public",
    protected: true,
    slowModeSeconds: 30,
  });
  expect(await outsider.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: true,
  });
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  await host.asUser.mutation(api.api.rooms.close, { meetingId });
  await expect(
    t.mutation(api.api.guests.enter, { code, name: "Late", device: "device-0002" }),
  ).rejects.toThrow("This room is closed");
});

test("a public room hides emails, avatars and the visitor list", async () => {
  const { t, host, outsider, code } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  const seen = await outsider.asUser.query(api.api.meetings.get, { code });
  expect(seen?.people).toEqual([expect.objectContaining({ name: "Host", role: "host" })]);
  expect(seen?.people[0]).toMatchObject({ email: null, imageUrl: null });
  const managed = await host.asUser.query(api.api.meetings.get, { code });
  expect(managed?.people).toHaveLength(3);
  expect(managed?.people.every((person) => person.email === null)).toBe(true);
});

test("an empty public room stays open, and can't be turned private", async () => {
  const { t, host, outsider, code, meetingId } = await setup();
  await t.mutation(internal.internal.realtime.endIfEmpty, { meetingId });
  expect((await t.run((ctx) => ctx.db.get("meetings", meetingId)))?.endedAt).toBeUndefined();
  await expect(
    host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "invited" }),
  ).rejects.toThrow("Close a public room");
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  expect(
    (await outsider.asUser.query(api.api.meetings.mine, { paginationOpts: page })).page,
  ).toEqual([]);
});

test("the people count follows who is in the call, counting each person once", async () => {
  const { t, outsider, code, memberOf, event } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  const visitor = await memberOf(outsider.userId);
  const people = async () =>
    (await t.query(api.api.rooms.directory, { paginationOpts: page })).page[0]?.people;
  await event("meeting.participantJoined", visitor, "peer-1");
  expect(await people()).toBe(1);
  await event("meeting.participantJoined", visitor, "peer-2");
  expect(await people()).toBe(1);
  await event("meeting.participantLeft", visitor, "peer-1");
  expect(await people()).toBe(1);
  await event("meeting.participantLeft", visitor, "peer-2");
  expect(await people()).toBe(0);
});

test("a full room turns newcomers away", async () => {
  const { t, outsider, code, meetingId } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  await t.run(async (ctx) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .unique();
    await ctx.db.patch("rooms", room!._id, { people: 50 });
  });
  await expect(
    t.query(internal.internal.realtime.joinDetails, { userId: outsider.userId, meetingId }),
  ).rejects.toThrow("This room is full");
});

test("guests join a public room as viewers without a picture or a recording", async () => {
  const { t, outsider, code, meetingId } = await setup();
  await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  const guestId = await t.run(async (ctx) => (await ctx.db.query("meetingGuests").first())!.userId);
  expect(
    await t.query(internal.internal.realtime.joinDetails, { userId: guestId, meetingId }),
  ).toMatchObject({ viewer: true, record: false });
  const details = await t.query(internal.internal.realtime.joinDetails, {
    userId: outsider.userId,
    meetingId,
  });
  expect(details).toMatchObject({ viewer: false, record: false });
  expect(details.imageUrl).toBeUndefined();
});

test("drawing and snapshots are off in public rooms", async () => {
  const { outsider, code, meetingId } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  await expect(
    outsider.asUser.mutation(api.api.annotations.draw, {
      meetingId,
      shareId: "share",
      color: "red",
      points: [0, 0, 1, 1],
    }),
  ).rejects.toThrow("Drawing is off");
  await expect(
    outsider.asUser.mutation(api.api.annotations.snapshotUploadUrl, { meetingId }),
  ).rejects.toThrow("Snapshots are off");
});

test("slow mode spaces out everyone's messages except the host's", async () => {
  const { host, outsider, code, meetingId } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  const say = (who: typeof host, body: string) =>
    who.asUser.mutation(api.api.messages.send, { meetingId, body });
  await say(outsider, "hello");
  await expect(say(outsider, "hello again")).rejects.toThrow("Slow mode is on");
  await say(host, "welcome");
  await say(host, "make yourself at home");
  vi.advanceTimersByTime(31_000);
  await say(outsider, "thanks");
});

test("a private meeting can use slow mode too", async () => {
  const { host, member, orgId } = await setup();
  const { meetingId } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "All hands",
    kind: "groupCall",
    recap: false,
    startsAt: Date.now() + 3_600_000,
    minutes: 15,
    timeZone: "UTC",
    inviteeIds: [member.userId],
    slowModeSeconds: 10,
  });
  const say = (body: string) => member.asUser.mutation(api.api.messages.send, { meetingId, body });
  await say("first");
  await expect(say("second")).rejects.toThrow("Slow mode is on");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, slowModeSeconds: 0 });
  await say("third");
});

test("a public recap shows numbers and only a checked summary", async () => {
  const { t, host, outsider, orgId, code, memberOf, event } = await setup();
  await outsider.asUser.mutation(api.api.meetings.enter, { code });
  const visitor = await memberOf(outsider.userId);
  await event("meeting.participantJoined", visitor);
  await event("meeting.participantLeft", visitor);
  await event("meeting.ended");
  const sessionId = await t.run(
    async (ctx) => (await ctx.db.query("meetingSessions").first())!._id,
  );
  await t.run((ctx) => ctx.db.patch("meetingSessions", sessionId, { summary: "A calm hour." }));
  const recap = () => t.query(api.api.rooms.recap, { code, number: 1 });
  expect(await recap()).toEqual({
    number: 1,
    title: "Quiet study hall",
    description: "Bring your work and sit with us.",
    startedAt: expect.any(Number),
    endedAt: expect.any(Number),
    people: 1,
    summary: null,
  });
  await t.run((ctx) => ctx.db.patch("meetingSessions", sessionId, { summaryCheck: "hidden" }));
  expect((await recap())?.summary).toBeNull();
  await t.run((ctx) => ctx.db.patch("meetingSessions", sessionId, { summaryCheck: "ok" }));
  expect((await recap())?.summary).toBe("A calm hour.");
  expect((await t.query(api.api.rooms.recaps, { code, paginationOpts: page })).page).toHaveLength(
    1,
  );
  const { code: privateCode } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Private planning",
    kind: "groupCall",
    recap: false,
    startsAt: Date.now() + 3_600_000,
    minutes: 15,
    timeZone: "UTC",
    inviteeIds: [],
  });
  expect(await t.query(api.api.rooms.recap, { code: privateCode, number: 1 })).toBeNull();
});

test("a waiting room makes guests and outsiders ask, and counts who asked and who got in", async () => {
  const { t, host, member, outsider, code, meetingId } = await setup();
  await host.asUser.mutation(api.api.rooms.update, { meetingId, waitingRoom: true });
  expect(await t.query(api.api.rooms.preview, { code })).toMatchObject({ waitingRoom: true });
  const stats = () => host.asUser.query(api.api.rooms.waitingRoom, { meetingId });
  expect(await stats()).toEqual({ waiting: 0, joined: 0, admitted: 0 });

  const secret = await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  expect(await t.query(api.api.guests.pass, { secret })).toMatchObject({ status: "waiting" });
  expect(await outsider.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: false,
    canAsk: true,
  });
  await expect(outsider.asUser.mutation(api.api.meetings.enter, { code })).rejects.toThrow(
    "Only invited people",
  );
  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  await member.asUser.mutation(api.api.meetings.enter, { code });
  expect(await stats()).toEqual({ waiting: 2, joined: 2, admitted: 0 });
  await expect(member.asUser.query(api.api.rooms.waitingRoom, { meetingId })).rejects.toThrow(
    "Only the host",
  );

  const waiting = async () =>
    (await host.asUser.query(api.api.joinRequests.waiting, { meetingId, paginationOpts: page }))
      .page;
  const [first, second] = await waiting();
  const guestRequest = first!.isGuest ? first! : second!;
  const outsiderRequest = first!.isGuest ? second! : first!;
  await host.asUser.mutation(api.api.joinRequests.admit, { requestId: guestRequest._id });
  expect(await t.query(api.api.guests.pass, { secret })).toMatchObject({ status: "in" });
  expect(await stats()).toEqual({ waiting: 1, joined: 2, admitted: 1 });
  expect(await t.run(async (ctx) => (await ctx.db.query("meetingGuests").first())?.deviceId)).toBe(
    device,
  );

  await host.asUser.mutation(api.api.joinRequests.deny, { requestId: outsiderRequest._id });
  expect(await stats()).toEqual({ waiting: 0, joined: 2, admitted: 1 });
  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  expect(await stats()).toEqual({ waiting: 1, joined: 2, admitted: 1 });
  const [again] = await waiting();
  await host.asUser.mutation(api.api.joinRequests.admit, { requestId: again!._id });
  expect(await stats()).toEqual({ waiting: 0, joined: 2, admitted: 2 });
  await outsider.asUser.mutation(api.api.messages.send, { meetingId, body: "thanks" });
});

test("hosts hear about the first person waiting in a room, not every one after", async () => {
  const { t, host, outsider, code, meetingId } = await setup();
  await host.asUser.mutation(api.api.rooms.update, { meetingId, waitingRoom: true });
  await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  await t.mutation(api.api.guests.enter, { code, name: "Ann", device: "device-0002" });
  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  const notes = await t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", host.userId))
      .collect(),
  );
  expect(notes).toMatchObject([{ kind: "joinRequest", title: "Quiet study hall" }]);
});

test("a banned device can't get into the waiting room, and deleting the room clears its counts", async () => {
  const { t, host, orgId, code, meetingId } = await setup();
  await host.asUser.mutation(api.api.rooms.update, { meetingId, waitingRoom: true });
  await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  await t.run((ctx) =>
    ctx.db.insert("bans", { orgId, userId: host.userId, deviceId: "device-0009", reason: "spam" }),
  );
  await expect(
    t.mutation(api.api.guests.enter, { code, name: "Sly", device: "device-0009" }),
  ).rejects.toThrow("banned");
  await expect(t.mutation(api.api.guests.enter, { code, name: "Sly" })).rejects.toThrow(
    "Reload the page",
  );
  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  expect(await t.run((ctx) => ctx.db.query("joinRequests").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toHaveLength(0);
});
