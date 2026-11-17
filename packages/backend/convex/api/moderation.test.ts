import type { WorkId } from "@convex-dev/workpool";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { FrameScores, MessageScores } from "../lib/moderation";

const page = { numItems: 20, cursor: null };
const workId = "work" as WorkId;
const HOUR = 60 * 60 * 1000;
const calm = { hate: 0, threat: 0, sexual: 0, insult: 0, spam: 0, personalInfo: 0, hostile: 0 };
const clean = { nudity: 0, sexualAct: 0, gore: 0, hateSymbol: 0 };

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
  const other = await signIn(t, "Other");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, member.userId, "Member");
  const { code, meetingId } = await host.asUser.mutation(api.api.rooms.create, {
    orgId,
    title: "Quiet study hall",
    description: "Bring your work and sit with us.",
    slowModeSeconds: 0,
    timeZone: "UTC",
  });
  await t.run((ctx) => ctx.db.patch("meetings", meetingId, { rtkMeetingId: "rtk-meeting" }));
  for (const person of [member, outsider, other]) {
    await person.asUser.mutation(api.api.meetings.enter, { code });
  }
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
  const joinCall = async (userId: Id<"users">) => {
    const memberId = await memberOf(userId);
    await t.mutation(internal.internal.realtime.recordEvent, {
      event: {
        event: "meeting.participantJoined",
        meeting: { id: "rtk-meeting", sessionId: "session-1" },
        participant: { customParticipantId: memberId, peerId: memberId },
      },
    });
    return memberId;
  };
  const say = (who: typeof host, body: string) =>
    who.asUser.mutation(api.api.messages.send, { meetingId, body });
  const screened = (messageId: Id<"messages">, scores: MessageScores) =>
    t.mutation(internal.internal.moderation.messageScreened, {
      workId,
      context: { messageId },
      result: { kind: "success", returnValue: scores },
    });
  const chatOf = async (who: typeof host) =>
    (await who.asUser.query(api.api.messages.list, { meetingId, paginationOpts: page })).page;
  const flags = async () =>
    (await host.asUser.query(api.api.moderation.flags, { orgId, paginationOpts: page })).page;
  const bans = async () =>
    (await host.asUser.query(api.api.moderation.bans, { orgId, paginationOpts: page })).page;
  const storeFrame = (type = "image/jpeg") =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type })));
  const frameScreened = (
    frame: {
      storageId: Id<"_storage">;
      targetMemberId: Id<"meetingMembers">;
      reporterId: Id<"meetingMembers">;
    },
    scores: FrameScores,
  ) =>
    t.mutation(internal.internal.moderation.frameScreened, {
      workId,
      context: { ...frame, meetingId },
      result: { kind: "success", returnValue: scores },
    });
  const stored = (storageId: Id<"_storage">) =>
    t.run((ctx) => ctx.db.system.get("_storage", storageId));
  return {
    t,
    host,
    member,
    outsider,
    other,
    orgId,
    code,
    meetingId,
    memberOf,
    joinCall,
    say,
    screened,
    chatOf,
    flags,
    bans,
    storeFrame,
    frameScreened,
    stored,
  };
};

test("a public message waits for its check, and only its author sees it meanwhile", async () => {
  const { host, outsider, orgId, say, screened, chatOf } = await setup();
  const messageId = await say(outsider, "hello everyone");
  expect(await chatOf(outsider)).toMatchObject([{ body: "hello everyone", pending: true }]);
  expect(await chatOf(host)).toEqual([]);
  await screened(messageId, calm);
  expect(await chatOf(host)).toMatchObject([{ body: "hello everyone", pending: false }]);
  const { meetingId } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Private planning",
    kind: "groupCall",
    recap: false,
    startsAt: Date.now() + HOUR,
    minutes: 15,
    timeZone: "UTC",
    inviteeIds: [],
  });
  await host.asUser.mutation(api.api.messages.send, { meetingId, body: "notes" });
  expect(
    (await host.asUser.query(api.api.messages.list, { meetingId, paginationOpts: page })).page,
  ).toMatchObject([{ body: "notes", pending: false }]);
});

test("a clear threat is removed and bans its author for a day, then for a month", async () => {
  const { host, outsider, code, meetingId, say, screened, chatOf, flags, bans } = await setup();
  const scores = { ...calm, threat: 0.95 };
  await screened(await say(outsider, "I will find you"), scores);
  expect(await chatOf(outsider)).toEqual([]);
  expect(await chatOf(host)).toEqual([]);
  expect(await flags()).toMatchObject([
    { kind: "message", reason: "threat", action: "ban", body: "I will find you", scores },
  ]);
  const [first] = await bans();
  expect(first).toMatchObject({ userName: "Outsider", reason: "threat", automatic: true });
  expect(Math.round((first!.expiresAt! - Date.now()) / HOUR)).toBe(24);
  await expect(say(outsider, "sorry")).rejects.toThrow("banned");
  await expect(outsider.asUser.mutation(api.api.meetings.enter, { code })).rejects.toThrow(
    "banned",
  );
  expect(await outsider.asUser.query(api.api.moderation.myStatus, { meetingId })).toMatchObject({
    ban: { reason: "threat" },
    lastRemoval: { kind: "message" },
  });
  vi.advanceTimersByTime(25 * HOUR);
  await screened(await say(outsider, "I will find you again"), scores);
  const [second] = await bans();
  expect(Math.round((second!.expiresAt! - Date.now()) / HOUR)).toBe(30 * 24);
});

test("three strikes in a day is a ban", async () => {
  const { outsider, meetingId, say, screened, bans } = await setup();
  const scores = { ...calm, insult: 0.8 };
  await screened(await say(outsider, "you're useless"), scores);
  await screened(await say(outsider, "really useless"), scores);
  expect(await bans()).toEqual([]);
  expect(await outsider.asUser.query(api.api.moderation.myStatus, { meetingId })).toMatchObject({
    ban: null,
    strikes: 2,
    lastRemoval: { reason: "insult" },
  });
  await screened(await say(outsider, "all of you"), scores);
  expect(await bans()).toMatchObject([{ reason: "insult" }]);
});

test("strikes older than a day don't count", async () => {
  const { outsider, say, screened, bans } = await setup();
  const scores = { ...calm, spam: 0.8 };
  await screened(await say(outsider, "buy followers"), scores);
  await screened(await say(outsider, "buy more followers"), scores);
  vi.advanceTimersByTime(25 * HOUR);
  await screened(await say(outsider, "last chance to buy"), scores);
  expect(await bans()).toEqual([]);
});

test("hosts lose the message but are never struck or banned", async () => {
  const { host, say, screened, chatOf, flags, bans } = await setup();
  await screened(await say(host, "I will find you"), { ...calm, threat: 0.95 });
  expect(await chatOf(host)).toEqual([]);
  expect(await flags()).toMatchObject([{ action: "removed", reason: "threat" }]);
  expect(await bans()).toEqual([]);
  await say(host, "sorry about that");
});

test("an unsettled message is removed without a strike only when it is hostile", async () => {
  const { host, outsider, meetingId, say, screened, chatOf, flags } = await setup();
  await screened(await say(outsider, "that's a silly idea"), { ...calm, insult: 0.5 });
  expect(await chatOf(host)).toHaveLength(1);
  await screened(await say(outsider, "nobody asked you"), { ...calm, insult: 0.5, hostile: 0.8 });
  expect(await chatOf(host)).toHaveLength(1);
  expect(await flags()).toMatchObject([{ action: "removed", reason: "insult" }]);
  expect(await outsider.asUser.query(api.api.moderation.myStatus, { meetingId })).toMatchObject({
    strikes: 0,
  });
});

test("a check that fails drops the message, says so, and blames nobody", async () => {
  const { t, outsider, meetingId, say, chatOf, flags, bans } = await setup();
  const messageId = await say(outsider, "hello?");
  await t.mutation(internal.internal.moderation.messageScreened, {
    workId,
    context: { messageId },
    result: { kind: "failed", error: "Jev 503" },
  });
  expect(await chatOf(outsider)).toEqual([]);
  expect(await flags()).toMatchObject([
    { kind: "message", reason: "unchecked", action: "removed", body: "hello?" },
  ]);
  expect(await bans()).toEqual([]);
  expect(await outsider.asUser.query(api.api.moderation.myStatus, { meetingId })).toMatchObject({
    ban: null,
    strikes: 0,
    lastRemoval: { reason: "unchecked" },
  });
});

test("a banned guest can't come back under a new name on the same device", async () => {
  const { t, code, meetingId, screened, bans } = await setup();
  const device = "device-0001";
  const secret = await t.mutation(api.api.guests.enter, { code, name: "Gus", device });
  const messageId = await t.mutation(api.api.messages.send, {
    meetingId,
    body: "I will find you",
    guest: secret,
  });
  await screened(messageId, { ...calm, threat: 0.95 });
  expect(await bans()).toMatchObject([{ userName: "Gus", isGuest: true }]);
  await expect(
    t.mutation(api.api.messages.send, { meetingId, body: "hi", guest: secret }),
  ).rejects.toThrow("banned");
  await expect(t.mutation(api.api.guests.enter, { code, name: "Not Gus", device })).rejects.toThrow(
    "banned",
  );
  await t.mutation(api.api.guests.enter, { code, name: "Someone else", device: "device-0002" });
});

test("managers lift bans and settle flags; members can't see either", async () => {
  const { host, member, outsider, orgId, say, screened, flags, bans } = await setup();
  await screened(await say(outsider, "I will find you"), { ...calm, threat: 0.95 });
  await expect(
    member.asUser.query(api.api.moderation.flags, { orgId, paginationOpts: page }),
  ).rejects.toThrow("Not allowed");
  await expect(
    member.asUser.query(api.api.moderation.bans, { orgId, paginationOpts: page }),
  ).rejects.toThrow("Not allowed");
  const [ban] = await bans();
  await expect(
    member.asUser.mutation(api.api.moderation.liftBan, { orgId, banId: ban!._id }),
  ).rejects.toThrow("Not allowed");
  await host.asUser.mutation(api.api.moderation.liftBan, { orgId, banId: ban!._id });
  await say(outsider, "thank you");
  const [flag] = await flags();
  await host.asUser.mutation(api.api.moderation.resolveFlag, { orgId, flagId: flag!._id });
  expect(await flags()).toMatchObject([{ resolved: true }]);
});

test("a manager bans from a flag until someone lifts it", async () => {
  const { host, outsider, orgId, say, screened, flags, bans } = await setup();
  await screened(await say(outsider, "buy followers"), { ...calm, spam: 0.8 });
  const [flag] = await flags();
  await host.asUser.mutation(api.api.moderation.ban, { orgId, flagId: flag!._id });
  expect(await bans()).toMatchObject([{ automatic: false, expiresAt: null, reason: "spam" }]);
  vi.advanceTimersByTime(365 * 24 * HOUR);
  await expect(say(outsider, "hello")).rejects.toThrow("banned");
});

test("a rude guest name is replaced, and a stale verdict is ignored", async () => {
  const { t, code, flags } = await setup();
  const secret = await t.mutation(api.api.guests.enter, {
    code,
    name: "Rude Name",
    device: "device-0001",
  });
  const guest = await t.run(async (ctx) => (await ctx.db.query("meetingGuests").first())!);
  const memberId = await t.run(
    async (ctx) =>
      (await ctx.db
        .query("meetingMembers")
        .withIndex("by_user", (q) => q.eq("userId", guest.userId))
        .unique())!._id,
  );
  const verdict = (name: string) =>
    t.mutation(internal.internal.moderation.nameScreened, {
      workId,
      context: { memberId },
      result: { kind: "success", returnValue: { name, scores: { rude: 0.9, staff: 0 } } },
    });
  await verdict("An older name");
  expect((await t.query(api.api.guests.pass, { secret }))?.name).toBe("Rude Name");
  await verdict("Rude Name");
  expect((await t.query(api.api.guests.pass, { secret }))?.name).toBe("Guest");
  expect(await flags()).toMatchObject([{ kind: "name", action: "removed", body: "Rude Name" }]);
});

test("a clean frame is deleted and nothing is recorded", async () => {
  const { outsider, member, meetingId, joinCall, storeFrame, frameScreened, stored, flags } =
    await setup();
  const targetMemberId = await joinCall(outsider.userId);
  const reporterId = await joinCall(member.userId);
  const storageId = await storeFrame();
  expect(
    await member.asUser.mutation(api.api.moderation.submitFrame, {
      meetingId,
      targetMemberId,
      storageId,
    }),
  ).toBe(true);
  await frameScreened({ storageId, targetMemberId, reporterId }, clean);
  expect(await stored(storageId)).toBeNull();
  expect(await flags()).toEqual([]);
});

test("one reporter only raises a watch; a second reporter gets the person kicked and banned", async () => {
  const {
    t,
    outsider,
    member,
    other,
    meetingId,
    joinCall,
    storeFrame,
    frameScreened,
    stored,
    flags,
    bans,
  } = await setup();
  const targetMemberId = await joinCall(outsider.userId);
  const first = await joinCall(member.userId);
  const second = await joinCall(other.userId);
  const scores = { ...clean, nudity: 0.95 };
  const firstFrame = await storeFrame();
  await frameScreened({ storageId: firstFrame, targetMemberId, reporterId: first }, scores);
  expect(await flags()).toMatchObject([{ kind: "frame", action: "watch", reason: "nudity" }]);
  expect((await flags())[0]?.imageUrl).toBeTypeOf("string");
  expect(await bans()).toEqual([]);
  expect(await member.asUser.query(api.api.moderation.watch, { meetingId })).toEqual([]);
  expect(await outsider.asUser.query(api.api.moderation.watch, { meetingId })).toEqual([]);
  expect(await other.asUser.query(api.api.moderation.watch, { meetingId })).toMatchObject([
    { memberId: targetMemberId },
  ]);
  const repeat = await storeFrame();
  await frameScreened({ storageId: repeat, targetMemberId, reporterId: first }, scores);
  expect(await bans()).toEqual([]);
  const confirming = await storeFrame();
  expect(
    await other.asUser.mutation(api.api.moderation.submitFrame, {
      meetingId,
      targetMemberId,
      storageId: confirming,
    }),
  ).toBe(true);
  await frameScreened({ storageId: confirming, targetMemberId, reporterId: second }, scores);
  expect(await bans()).toMatchObject([{ userName: "Outsider", reason: "nudity" }]);
  expect(await other.asUser.query(api.api.moderation.watch, { meetingId })).toEqual([]);
  expect(await stored(confirming)).not.toBeNull();
  const banFlag = (await flags()).find((flag) => flag.action === "ban");
  await t.mutation(internal.internal.moderation.dropEvidence, { flagId: banFlag!._id });
  expect(await stored(confirming)).toBeNull();
});

test("a host's report is enough, and any confirmed frame is a ban", async () => {
  const { host, outsider, member, meetingId, joinCall, storeFrame, frameScreened, flags, bans } =
    await setup();
  const targetMemberId = await joinCall(outsider.userId);
  const reporterId = await joinCall(host.userId);
  await joinCall(member.userId);
  const storageId = await storeFrame();
  await frameScreened({ storageId, targetMemberId, reporterId }, { ...clean, gore: 0.75 });
  expect(await flags()).toMatchObject([
    { kind: "frame", action: "ban", reason: "gore", reporterName: "Host", reporterIsGuest: false },
  ]);
  expect(await bans()).toMatchObject([{ userName: "Outsider", reason: "gore", automatic: true }]);
  await expect(
    outsider.asUser.mutation(api.api.messages.send, { meetingId, body: "hi" }),
  ).rejects.toThrow("banned");
});

test("guests can't confirm each other; a signed-in reporter is needed to ban", async () => {
  const { t, outsider, member, code, joinCall, storeFrame, frameScreened, flags, bans } =
    await setup();
  const guestJoins = async (name: string, device: string) => {
    await t.mutation(api.api.guests.enter, { code, name, device });
    const guest = await t.run((ctx) => ctx.db.query("meetingGuests").order("desc").first());
    return joinCall(guest!.userId);
  };
  const targetMemberId = await joinCall(outsider.userId);
  const first = await guestJoins("Gus", "device-0001");
  const second = await guestJoins("Gus again", "device-0002");
  const scores = { ...clean, nudity: 0.95 };
  const report = async (reporterId: Id<"meetingMembers">) =>
    frameScreened({ storageId: await storeFrame(), targetMemberId, reporterId }, scores);
  const actions = async () => (await flags()).map((flag) => flag.action);

  await report(first);
  await report(second);
  expect(await actions()).toEqual(["review", "review"]);
  expect(await bans()).toEqual([]);

  const signedIn = await joinCall(member.userId);
  await report(first);
  expect(await actions()).toEqual(["watch", "review", "review"]);
  await report(second);
  expect(await actions()).toEqual(["watch", "watch", "review", "review"]);
  expect(await bans()).toEqual([]);

  await report(signedIn);
  expect((await flags())[0]).toMatchObject({ action: "ban", reporterName: "Member" });
  expect(await bans()).toMatchObject([{ userName: "Outsider", reason: "nudity" }]);
});

test("a guest's report is confirmed by a signed-in one, and the other way round", async () => {
  const { t, outsider, member, code, joinCall, storeFrame, frameScreened, bans } = await setup();
  await t.mutation(api.api.guests.enter, { code, name: "Gus", device: "device-0001" });
  const guest = await t.run((ctx) => ctx.db.query("meetingGuests").first());
  const targetMemberId = await joinCall(outsider.userId);
  const guestReporter = await joinCall(guest!.userId);
  const signedIn = await joinCall(member.userId);
  const scores = { ...clean, hateSymbol: 0.8 };
  await frameScreened(
    { storageId: await storeFrame(), targetMemberId, reporterId: signedIn },
    scores,
  );
  expect(await bans()).toEqual([]);
  await frameScreened(
    { storageId: await storeFrame(), targetMemberId, reporterId: guestReporter },
    scores,
  );
  expect(await bans()).toMatchObject([{ reason: "hateSymbol" }]);
});

test("in a room of two a flagged frame goes to the managers", async () => {
  const { t, host, outsider, member, joinCall, storeFrame, frameScreened, flags, bans } =
    await setup();
  const targetMemberId = await joinCall(outsider.userId);
  const reporterId = await joinCall(member.userId);
  const storageId = await storeFrame();
  await frameScreened({ storageId, targetMemberId, reporterId }, { ...clean, nudity: 0.95 });
  expect(await flags()).toMatchObject([{ action: "review" }]);
  expect(await bans()).toEqual([]);
  const notes = await t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", host.userId))
      .collect(),
  );
  expect(notes).toMatchObject([{ kind: "moderationReview", title: "Quiet study hall" }]);
});

test("frames are only accepted from people in the call, about someone else in it", async () => {
  const { outsider, member, other, meetingId, joinCall, storeFrame, stored } = await setup();
  const targetMemberId = await joinCall(outsider.userId);
  const submit = async (who: typeof member, target: Id<"meetingMembers">, type?: string) => {
    const storageId = await storeFrame(type);
    const accepted = await who.asUser.mutation(api.api.moderation.submitFrame, {
      meetingId,
      targetMemberId: target,
      storageId,
    });
    return { accepted, kept: (await stored(storageId)) !== null };
  };
  expect(await submit(member, targetMemberId)).toEqual({ accepted: false, kept: false });
  const reporterId = await joinCall(member.userId);
  expect(await submit(member, reporterId)).toEqual({ accepted: false, kept: false });
  expect(await submit(member, targetMemberId, "image/png")).toEqual({
    accepted: false,
    kept: false,
  });
  expect(await submit(member, targetMemberId)).toEqual({ accepted: true, kept: true });
  await joinCall(other.userId);
  expect(await submit(other, targetMemberId)).toEqual({ accepted: false, kept: false });
  vi.advanceTimersByTime(31_000);
  expect(await submit(other, targetMemberId)).toEqual({ accepted: true, kept: true });
});

test("a summary is public only after it passes the check", async () => {
  const { t, code, outsider, joinCall } = await setup();
  await joinCall(outsider.userId);
  const sessionId = await t.run(
    async (ctx) => (await ctx.db.query("meetingSessions").first())!._id,
  );
  await t.run((ctx) => ctx.db.patch("meetingSessions", sessionId, { summary: "People studied." }));
  const summaryScreened = (scores: MessageScores) =>
    t.mutation(internal.internal.moderation.summaryScreened, {
      workId,
      context: { sessionId },
      result: { kind: "success", returnValue: scores },
    });
  const summary = async () => (await t.query(api.api.rooms.recap, { code, number: 1 }))?.summary;
  await summaryScreened({ ...calm, hate: 0.8 });
  expect(await summary()).toBeNull();
  await summaryScreened(calm);
  expect(await summary()).toBe("People studied.");
});

test("the state sent to Jev carries the room, recent messages and the new message", async () => {
  const { t, host, outsider, say, screened } = await setup();
  await screened(await say(host, "welcome in"), calm);
  const messageId = await say(outsider, "thanks for having me");
  expect(await t.query(internal.internal.moderation.messageState, { messageId })).toEqual({
    room: { title: "Quiet study hall", description: "Bring your work and sit with us." },
    recent: [{ author: "Host", text: "welcome in" }],
    message: { author: "Outsider", text: "thanks for having me" },
  });
});
