import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";

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
  vi.useRealTimers();
});

const setup = async () => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const colleague = await signIn(t, "Colleague");
  const outsider = await signIn(t, "Outsider");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, colleague.userId, "Member");
  await t.run(async (ctx) => {
    await ctx.db.patch("users", colleague.userId, { email: "col@acme.com", isVerified: true });
  });
  const create = (title: string) =>
    host.asUser.mutation(api.api.meetings.create, {
      orgId,
      title,
      kind: "groupCall",
      recap: false,
      startsAt: Date.UTC(2026, 10, 18, 9, 0),
      minutes: 30,
      timeZone: "UTC",
      inviteeIds: [],
    });
  return { t, host, colleague, outsider, orgId, create };
};

test("invite-only meetings hide from people and guests who weren't invited", async () => {
  const { t, colleague, create } = await setup();
  const { code } = await create("Board");
  expect(await t.query(api.api.guests.preview, { code })).toEqual({
    access: "invited",
    title: null,
    kind: "groupCall",
  });
  await expect(t.mutation(api.api.guests.enter, { code, name: "Gus" })).rejects.toThrow(
    "Only invited people",
  );
  expect(await colleague.asUser.query(api.api.meetings.get, { code })).toBeNull();
  expect(await colleague.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: false,
  });
  await expect(colleague.asUser.mutation(api.api.meetings.enter, { code })).rejects.toThrow(
    "Only invited people",
  );
});

test("org meetings let anyone in the org walk in, but not outsiders", async () => {
  const { host, colleague, outsider, create } = await setup();
  const { meetingId, code } = await create("All hands");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "org" });
  await colleague.asUser.mutation(api.api.meetings.enter, { code });
  expect(await colleague.asUser.query(api.api.meetings.get, { code })).toMatchObject({
    title: "All hands",
    me: { role: "participant", canInvite: false },
  });
  await expect(outsider.asUser.mutation(api.api.meetings.enter, { code })).rejects.toThrow(
    "Only invited people",
  );
});

test("link meetings let guests in with just a name, scoped to that meeting", async () => {
  const { t, host, outsider, create } = await setup();
  const { meetingId, code } = await create("Open office hours");
  const other = await create("Other");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  await outsider.asUser.mutation(api.api.meetings.enter, { code });

  const guest = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  expect(await t.query(api.api.meetings.get, { code, guest })).toMatchObject({
    title: "Open office hours",
    me: { isGuest: true, canControl: false, canInvite: false },
  });
  expect(await t.query(api.api.meetings.get, { code: other.code, guest })).toBeNull();
  await t.action(api.api.meetings.join, { meetingId, guest });
  await t.mutation(api.api.messages.send, { meetingId, body: "Hello from a guest", guest });
  const chat = await host.asUser.query(api.api.messages.list, { meetingId, paginationOpts: page });
  expect(chat.page).toMatchObject([{ body: "Hello from a guest", authorName: "Gus" }]);
  await expect(
    t.action(api.api.meetings.join, { meetingId: other.meetingId, guest }),
  ).rejects.toThrow("not invited");
  expect(await t.query(api.api.meetings.get, { code, guest: "f".repeat(64) })).toBeNull();
  await expect(
    t.mutation(api.api.messages.send, { meetingId, body: "Hi", guest: "f".repeat(64) }),
  ).rejects.toThrow("expired");
});

test("invites follow who-can-invite, add org members, and email guests a personal link", async () => {
  vi.useFakeTimers();
  const { t, host, colleague, create } = await setup();
  const { meetingId, code } = await create("Review");
  await host.asUser.mutation(api.api.meetings.invite, {
    meetingId,
    emails: ["col@acme.com", "client@example.com"],
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const meeting = await host.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.people.map((p) => [p.name, p.response, p.isGuest])).toEqual([
    ["Host", "accepted", false],
    ["Colleague", "pending", false],
    ["client", "pending", true],
  ]);
  await expect(
    colleague.asUser.mutation(api.api.meetings.invite, { meetingId, emails: ["x@example.com"] }),
  ).rejects.toThrow("Only the host");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, inviters: "everyone" });
  await colleague.asUser.mutation(api.api.meetings.invite, {
    meetingId,
    emails: ["x@example.com"],
  });
});

test("inviting the same outside email twice keeps one guest and sends them another link that works too", async () => {
  vi.useFakeTimers();
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Review");
  await host.asUser.mutation(api.api.meetings.invite, {
    meetingId,
    emails: ["client@example.com"],
  });
  const tokenValue = () =>
    t.run(async (ctx) => {
      const guest = await ctx.db.query("meetingGuests").first();
      return (await ctx.db.get("tokens", guest!.tokenId))?.value;
    });
  const before = await tokenValue();
  const again = await host.asUser.mutation(api.api.meetings.invite, {
    meetingId,
    emails: ["client@example.com"],
  });
  expect(again).toMatchObject({ guests: [], resent: ["client@example.com"], skipped: [] });
  expect(await tokenValue()).toBe(before);
  const extraLinks = await t.run(async (ctx) =>
    (await ctx.db.query("tokens").collect()).filter((token) => token.guestId),
  );
  expect(extraLinks).toHaveLength(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const meeting = await host.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.people.filter((p) => p.isGuest)).toHaveLength(1);
});

test("invites, moves and cancels carry one calendar event, with the guest's own link", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 1));
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
  vi.stubEnv("EMAIL_FROM", "meetings@example.com");
  const emails: {
    to: string | { address: string };
    text: string;
    attachments: { content: string }[];
  }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      emails.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ success: true, result: { message_id: "<m@test>" } }));
    }),
  );
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Review");
  await host.asUser.mutation(api.api.meetings.invite, {
    meetingId,
    emails: ["col@acme.com", "client@example.com"],
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await host.asUser.mutation(api.api.meetings.reschedule, {
    meetingId,
    startsAt: Date.UTC(2026, 10, 19, 9, 0),
    minutes: 30,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const sentTo = (address: string) =>
    emails
      .filter((email) => (typeof email.to === "string" ? email.to : email.to.address) === address)
      .map((email) => {
        const ics = atob(email.attachments[0]!.content).replace(/\r\n /g, "");
        return {
          text: email.text,
          event: [/METHOD:(\w+)/, /UID:(\S+)/, /SEQUENCE:(\d+)/, /DTSTART;(\S+)/, /URL:(\S+)/].map(
            (field) => ics.match(field)?.[1],
          ),
        };
      });
  const [invited, moved] = sentTo("client@example.com").map(({ event }) => event[4]!);
  expect(invited).toMatch(/^http:\/\/localhost:3000\/guest\/[0-9a-f]{64}$/);
  expect(moved).toMatch(/^http:\/\/localhost:3000\/guest\/[0-9a-f]{64}$/);
  expect(moved).not.toBe(invited);
  expect(sentTo("client@example.com")[1]?.text).toContain(moved);
  expect(await t.query(api.api.guests.pass, { secret: invited!.slice(-64) })).toMatchObject({
    code,
  });
  expect(await t.query(api.api.guests.pass, { secret: moved!.slice(-64) })).toMatchObject({ code });

  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.query(api.api.guests.pass, { secret: invited!.slice(-64) })).toBeNull();
  expect(await t.query(api.api.guests.pass, { secret: moved!.slice(-64) })).toBeNull();
  const uid = `${code}@convex-meetings`;
  const link = `http://localhost:3000/m/${code}`;
  expect(sentTo("col@acme.com").map(({ event }) => event)).toEqual([
    ["REQUEST", uid, "0", "TZID=UTC:20261118T090000", link],
    ["REQUEST", uid, "1", "TZID=UTC:20261119T090000", link],
    ["CANCEL", uid, "2", "TZID=UTC:20261119T090000", link],
  ]);
  expect(sentTo("client@example.com").map(({ event }) => event)).toEqual([
    ["REQUEST", uid, "0", "TZID=UTC:20261118T090000", invited],
    ["REQUEST", uid, "1", "TZID=UTC:20261119T090000", moved],
    ["CANCEL", uid, "2", "TZID=UTC:20261119T090000", link],
  ]);
});

test("an invited guest names themselves, and a removed guest stays out", async () => {
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Interview");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const guest = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  await t.mutation(api.api.guests.rename, { secret: guest, name: "Gus Grant" });
  expect(await t.query(api.api.guests.pass, { secret: guest })).toMatchObject({
    code,
    name: "Gus Grant",
  });
  await expect(
    t.mutation(api.api.meetings.invite, { meetingId, emails: ["a@b.co"], guest } as never),
  ).rejects.toThrow();
  const member = (await host.asUser.query(api.api.meetings.get, { code }))!.people.find(
    (p) => p.isGuest,
  )!;
  await host.asUser.mutation(api.api.calls.remove, { meetingMemberId: member._id });
  await expect(t.action(api.api.meetings.join, { meetingId, guest })).rejects.toThrow(
    "removed you",
  );
});

test("cancelling a meeting deletes its guests and their passes", async () => {
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Demo");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const guest = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  expect(await t.query(api.api.guests.pass, { secret: guest })).toBeNull();
  const leftovers = await t.run(async (ctx) => ({
    guests: await ctx.db.query("meetingGuests").take(10),
    guestUsers: (await ctx.db.query("users").take(50)).filter((u) => u.method === "guest"),
  }));
  expect(leftovers).toEqual({ guests: [], guestUsers: [] });
});

test("a guest watching a meeting the host cancels gets empty answers, not errors", async () => {
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Demo");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const guest = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });

  expect(await t.query(api.api.meetings.get, { code, guest })).toBeNull();
  expect(
    await t.query(api.api.messages.list, { meetingId, paginationOpts: page, guest }),
  ).toMatchObject({ page: [], isDone: true });
  expect(
    await t.query(api.api.transcripts.live, { meetingId, paginationOpts: page, guest }),
  ).toMatchObject({ page: [], isDone: true });
  expect(await t.query(api.api.moderation.myStatus, { meetingId, guest })).toBeNull();
  expect(await t.query(api.api.moderation.watch, { meetingId, guest })).toEqual([]);
  expect(
    await host.asUser.query(api.api.messages.list, { meetingId, paginationOpts: page }),
  ).toMatchObject({ page: [] });
});

test("a new link shuts the old one for newcomers, but keeps the meeting and its guests", async () => {
  const { t, host, colleague, create } = await setup();
  const { meetingId, code } = await create("Office hours");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const gus = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  await expect(
    colleague.asUser.mutation(api.api.meetings.newLink, { meetingId }),
  ).rejects.toThrow();

  const link = await host.asUser.mutation(api.api.meetings.newLink, { meetingId });
  expect(link).not.toBe(code);
  expect(await t.query(api.api.guests.preview, { code })).toMatchObject({ access: "invited" });
  await expect(t.mutation(api.api.guests.enter, { code, name: "Ida" })).rejects.toThrow(
    "Only invited people",
  );
  expect(await t.query(api.api.guests.preview, { code: link })).toMatchObject({
    access: "link",
    title: "Office hours",
  });
  const ida = await t.mutation(api.api.guests.enter, { code: link, name: "Ida" });
  for (const guest of [gus, ida]) {
    expect(await t.query(api.api.guests.pass, { secret: guest })).toMatchObject({ code });
  }
  expect(await host.asUser.query(api.api.meetings.get, { code })).toMatchObject({ code, link });
  expect(await host.asUser.query(api.api.meetings.get, { code: link })).toMatchObject({ code });
  expect(await colleague.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: false,
  });
  await colleague.asUser.mutation(api.api.meetings.enter, { code: link });
  expect(await colleague.asUser.query(api.api.meetings.get, { code })).toMatchObject({ link });

  const next = await host.asUser.mutation(api.api.meetings.newLink, { meetingId });
  expect(await t.query(api.api.guests.preview, { code: link })).toBeNull();
  expect(await t.query(api.api.guests.preview, { code: next })).toMatchObject({ access: "link" });
});

test("ask meetings let the org walk in and make everyone else wait for a host", async () => {
  const { host, colleague, outsider, create } = await setup();
  const { meetingId, code } = await create("Clinic");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "ask" });
  const waiting = () =>
    host.asUser.query(api.api.joinRequests.waiting, { meetingId, paginationOpts: page });

  expect(await colleague.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: true,
    canAsk: false,
  });
  expect(await outsider.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    canEnter: false,
    canAsk: true,
    request: null,
  });
  await expect(outsider.asUser.mutation(api.api.meetings.enter, { code })).rejects.toThrow(
    "Only invited people",
  );

  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  expect(await outsider.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    request: "waiting",
  });
  expect(await outsider.asUser.query(api.api.meetings.get, { code })).toBeNull();
  const [request] = (await waiting()).page;
  expect((await waiting()).page).toEqual([
    { _id: request!._id, name: "Outsider", imageUrl: null, isGuest: false },
  ]);
  const inbox = await host.asUser.query(api.api.inbox.list, { paginationOpts: page });
  expect(inbox.page).toMatchObject([{ kind: "joinRequest", title: "Clinic", meetingCode: code }]);

  await colleague.asUser.mutation(api.api.meetings.enter, { code });
  expect(
    (
      await colleague.asUser.query(api.api.joinRequests.waiting, {
        meetingId,
        paginationOpts: page,
      })
    ).page,
  ).toEqual([]);
  await expect(
    colleague.asUser.mutation(api.api.joinRequests.admit, { requestId: request!._id }),
  ).rejects.toThrow("Only the host");

  await host.asUser.mutation(api.api.joinRequests.deny, { requestId: request!._id });
  expect(await outsider.asUser.query(api.api.meetings.door, { code })).toMatchObject({
    request: "denied",
  });
  expect((await waiting()).page).toEqual([]);

  await outsider.asUser.mutation(api.api.joinRequests.ask, { code });
  const [again] = (await waiting()).page;
  await host.asUser.mutation(api.api.joinRequests.admit, { requestId: again!._id });
  expect(await outsider.asUser.query(api.api.meetings.get, { code })).toMatchObject({
    title: "Clinic",
    me: { role: "participant", response: "accepted", canControl: false },
  });
  expect((await waiting()).page).toEqual([]);
});

test("guests on ask meetings wait for a host before their pass works", async () => {
  const { t, host, create } = await setup();
  const { meetingId, code } = await create("Clinic");
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "ask" });
  expect(await t.query(api.api.guests.preview, { code })).toEqual({
    access: "ask",
    title: "Clinic",
    kind: "groupCall",
  });

  const gus = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  const ida = await t.mutation(api.api.guests.enter, { code, name: "Ida" });
  expect(await t.query(api.api.guests.pass, { secret: gus })).toEqual({
    code,
    title: "Clinic",
    name: "Gus",
    status: "waiting",
  });
  expect(await t.query(api.api.meetings.get, { code, guest: gus })).toBeNull();

  const requests = await host.asUser.query(api.api.joinRequests.waiting, {
    meetingId,
    paginationOpts: page,
  });
  const idOf = (name: string) => requests.page.find((r) => r.name === name)!._id;
  expect(requests.page.map((r) => [r.name, r.isGuest])).toEqual([
    ["Gus", true],
    ["Ida", true],
  ]);
  await host.asUser.mutation(api.api.joinRequests.admit, { requestId: idOf("Gus") });
  await host.asUser.mutation(api.api.joinRequests.deny, { requestId: idOf("Ida") });

  expect(await t.query(api.api.guests.pass, { secret: gus })).toMatchObject({ status: "in" });
  expect(await t.query(api.api.meetings.get, { code, guest: gus })).toMatchObject({
    title: "Clinic",
    me: { isGuest: true, response: "accepted" },
  });
  expect(await t.query(api.api.guests.pass, { secret: ida })).toMatchObject({
    status: "denied",
  });

  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  expect(await t.query(api.api.guests.pass, { secret: ida })).toBeNull();
  const leftovers = await t.run(async (ctx) => ({
    requests: await ctx.db.query("joinRequests").take(10),
    guestUsers: (await ctx.db.query("users").take(50)).filter((u) => u.method === "guest"),
  }));
  expect(leftovers).toEqual({ requests: [], guestUsers: [] });
});
