import { expect, test } from "vite-plus/test";
import { signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";

const page = { numItems: 20, cursor: null };

const setup = async () => {
  const t = testBackend();
  const host = await signIn(t, "Host");
  const orgId = await host.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const { meetingId, code } = await host.asUser.mutation(api.api.meetings.create, {
    orgId,
    title: "Standup",
    kind: "groupCall",
    recap: false,
    startsAt: Date.UTC(2026, 10, 18, 9, 0),
    minutes: 15,
    timeZone: "UTC",
    inviteeIds: [],
  });
  await host.asUser.mutation(api.api.meetings.updateSettings, { meetingId, access: "link" });
  const guest = await t.mutation(api.api.guests.enter, { code, name: "Gus" });
  const messageId = await host.asUser.mutation(api.api.messages.send, {
    meetingId,
    body: "Morning!",
  });
  return { t, host, guest, meetingId, code, messageId };
};

test("people and guests toggle reactions and see who reacted", async () => {
  const { t, host, guest, meetingId, messageId } = await setup();
  await host.asUser.mutation(api.api.messages.react, { messageId, emoji: "👍" });
  await t.mutation(api.api.messages.react, { messageId, emoji: "👍", guest });
  await t.mutation(api.api.messages.react, { messageId, emoji: "🎉", guest });

  const forHost = await host.asUser.query(api.api.messages.list, {
    meetingId,
    paginationOpts: page,
  });
  expect(forHost.page[0]?.reactions).toEqual([
    { emoji: "👍", count: 2, mine: true, names: ["Host", "Gus"] },
    { emoji: "🎉", count: 1, mine: false, names: ["Gus"] },
  ]);

  expect(await host.asUser.mutation(api.api.messages.react, { messageId, emoji: "👍" })).toBe(
    false,
  );
  const forGuest = await t.query(api.api.messages.list, {
    meetingId,
    paginationOpts: page,
    guest,
  });
  expect(forGuest.page[0]?.reactions).toEqual([
    { emoji: "👍", count: 1, mine: true, names: ["Gus"] },
    { emoji: "🎉", count: 1, mine: true, names: ["Gus"] },
  ]);
});

test("only the allowed reactions work, removed people can't react, and cancel clears them", async () => {
  const { t, host, guest, meetingId, code, messageId } = await setup();
  await expect(
    host.asUser.mutation(api.api.messages.react, { messageId, emoji: "💩" as never }),
  ).rejects.toThrow();
  const gus = (await host.asUser.query(api.api.meetings.get, { code }))!.people.find(
    (p) => p.isGuest,
  )!;
  await host.asUser.mutation(api.api.calls.remove, { meetingMemberId: gus._id });
  await expect(
    t.mutation(api.api.messages.react, { messageId, emoji: "😂", guest }),
  ).rejects.toThrow("removed you");

  await host.asUser.mutation(api.api.messages.react, { messageId, emoji: "❤️" });
  await host.asUser.mutation(api.api.meetings.cancel, { meetingId });
  expect(await t.run((ctx) => ctx.db.query("messageReactions").take(10))).toEqual([]);
});
