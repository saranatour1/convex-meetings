import { afterEach, expect, test, vi } from "vite-plus/test";
import { addOrgMember, signIn, testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const setup = async () => {
  const t = testBackend();
  const caller = await signIn(t, "Ada");
  const callee = await signIn(t, "Grace");
  const outsider = await signIn(t, "Linus");
  const orgId = await caller.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  await addOrgMember(t, orgId, callee.userId, "Member");
  return { t, caller, callee, outsider, orgId };
};

test("ringing shows the call to the callee, and accepting opens the meeting for them", async () => {
  const { caller, callee, orgId } = await setup();
  const { code } = await caller.asUser.mutation(api.api.rings.ring, {
    orgId,
    calleeId: callee.userId,
    timeZone: "UTC",
  });

  const incoming = await callee.asUser.query(api.api.rings.incoming, {});
  expect(incoming?.callerName).toBe("Ada");
  expect(await caller.asUser.query(api.api.rings.incoming, {})).toBeNull();
  expect(await callee.asUser.query(api.api.inbox.unreadCount, {})).toBe(0);

  expect(
    await callee.asUser.mutation(api.api.rings.answer, { ringId: incoming!._id, accept: true }),
  ).toEqual({ code });
  expect(await callee.asUser.query(api.api.rings.incoming, {})).toBeNull();
  const meeting = await callee.asUser.query(api.api.meetings.get, { code });
  expect(meeting?.me.response).toBe("accepted");
  const outgoing = await caller.asUser.query(api.api.rings.outgoing, { meetingId: meeting!._id });
  expect(outgoing).toMatchObject({ status: "accepted", calleeName: "Grace" });
});

test("an unanswered ring becomes a missed call after 30 seconds", async () => {
  vi.useFakeTimers();
  const { t, caller, callee, orgId } = await setup();
  await caller.asUser.mutation(api.api.rings.ring, {
    orgId,
    calleeId: callee.userId,
    timeZone: "UTC",
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await callee.asUser.query(api.api.rings.incoming, {})).toBeNull();
  expect(await callee.asUser.query(api.api.inbox.unreadCount, {})).toBe(1);
});

test("only org members can be rung, and only the callee can answer", async () => {
  const { caller, callee, outsider, orgId } = await setup();
  await expect(
    caller.asUser.mutation(api.api.rings.ring, {
      orgId,
      calleeId: outsider.userId,
      timeZone: "UTC",
    }),
  ).rejects.toThrow("Only members of this organization can be invited");
  await expect(
    caller.asUser.mutation(api.api.rings.ring, { orgId, calleeId: caller.userId, timeZone: "UTC" }),
  ).rejects.toThrow("You can't call yourself");

  await caller.asUser.mutation(api.api.rings.ring, {
    orgId,
    calleeId: callee.userId,
    timeZone: "UTC",
  });
  const incoming = await callee.asUser.query(api.api.rings.incoming, {});
  await expect(
    outsider.asUser.mutation(api.api.rings.answer, { ringId: incoming!._id, accept: true }),
  ).rejects.toThrow("This call isn't for you");
  await caller.asUser.mutation(api.api.rings.cancel, { ringId: incoming!._id });
  expect(await callee.asUser.query(api.api.rings.incoming, {})).toBeNull();
});
