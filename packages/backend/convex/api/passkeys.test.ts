import { sessionIdentity } from "@convex-dev/auth/test";
import { expect, test } from "vite-plus/test";
import { newSession, signIn, testBackend } from "../../tools/auth-test-setup";
import { createAuthenticator } from "../../tools/passkey-authenticator";
import { api } from "../_generated/api";

const page = { numItems: 10, cursor: null };

type Caller = Awaited<ReturnType<typeof signIn>>["asUser"];

const enroll = async (caller: Caller) => {
  const authenticator = await createAuthenticator();
  const started = await caller.mutation(api.api.passkeys.start, {});
  if (started.step !== "enroll") throw new Error("Expected an enrollment");
  const result = await caller.mutation(api.api.passkeys.finishEnroll, {
    response: await authenticator.register(started.options),
  });
  return { authenticator, result };
};

test("an unverified session can't use org or meeting functions", async () => {
  const t = testBackend();
  const alice = await signIn(t, "Alice", { passkeyVerified: false });
  await expect(alice.asUser.mutation(api.api.orgs.create, { name: "Acme" })).rejects.toThrow(
    "Passkey required",
  );
  await expect(alice.asUser.query(api.api.orgs.listMine, { paginationOpts: page })).rejects.toThrow(
    "Passkey required",
  );
  await expect(alice.asUser.query(api.api.inbox.unreadCount, {})).rejects.toThrow(
    "Passkey required",
  );
});

test("verification is per session, not per user", async () => {
  const t = testBackend();
  const verified = await signIn(t, "Alice");
  const orgId = await verified.asUser.mutation(api.api.orgs.create, { name: "Acme" });
  const other = await newSession(t, verified.userId, { passkeyVerified: false });
  await expect(other.query(api.api.members.list, { orgId, paginationOpts: page })).rejects.toThrow(
    "Passkey required",
  );
  expect(
    await verified.asUser.query(api.api.members.list, { orgId, paginationOpts: page }),
  ).toMatchObject({
    page: [{ userId: verified.userId }],
  });
});

test("a signed-out caller has no passkey step", async () => {
  const t = testBackend();
  expect(await t.query(api.api.passkeys.step, {})).toBeNull();
  await expect(t.mutation(api.api.passkeys.start, {})).rejects.toThrow("Unauthenticated");
});

test("a new account adds a passkey, which verifies that session", async () => {
  const t = testBackend();
  const alice = await signIn(t, "Alice", { passkeyVerified: false });
  expect(await alice.asUser.query(api.api.passkeys.step, {})).toBe("enroll");

  const { result } = await enroll(alice.asUser);

  expect(result).toEqual({ error: null });
  expect(await alice.asUser.query(api.api.passkeys.step, {})).toBe("done");
  await alice.asUser.mutation(api.api.orgs.create, { name: "Acme" });
});

test("a second passkey can't be enrolled without verifying", async () => {
  const t = testBackend();
  const first = await signIn(t, "Alice", { passkeyVerified: false });
  await enroll(first.asUser);
  const started = await first.asUser.mutation(api.api.passkeys.start, {});
  expect(started.step).toBe("verify");
  const authenticator = await createAuthenticator();
  await expect(
    first.asUser.mutation(api.api.passkeys.finishEnroll, {
      response: await authenticator.register({ challenge: "AAAA", user: { id: "AAAA" } }),
    }),
  ).rejects.toThrow("You already have a passkey");
});

test("a later session is verified with the passkey", async () => {
  const t = testBackend();
  const enrolled = await signIn(t, "Alice", { passkeyVerified: false });
  const { authenticator } = await enroll(enrolled.asUser);
  const later = await newSession(t, enrolled.userId, { passkeyVerified: false });
  expect(await later.query(api.api.passkeys.step, {})).toBe("verify");

  const started = await later.mutation(api.api.passkeys.start, {});
  if (started.step !== "verify") throw new Error("Expected a verification");
  const result = await later.mutation(api.api.passkeys.finishVerify, {
    response: await authenticator.assert(started.options),
  });

  expect(result).toEqual({ error: null });
  expect(await later.query(api.api.passkeys.step, {})).toBe("done");
});

test("someone else's passkey doesn't verify the session", async () => {
  const t = testBackend();
  const alice = await signIn(t, "Alice", { passkeyVerified: false });
  await enroll(alice.asUser);
  const mallory = await signIn(t, "Mallory", { passkeyVerified: false });
  const { authenticator: mallorysKey } = await enroll(mallory.asUser);
  const aliceLater = await newSession(t, alice.userId, { passkeyVerified: false });

  const started = await aliceLater.mutation(api.api.passkeys.start, {});
  if (started.step !== "verify") throw new Error("Expected a verification");
  const result = await aliceLater.mutation(api.api.passkeys.finishVerify, {
    response: await mallorysKey.assert(started.options),
  });

  expect(result.error).not.toBeNull();
  expect(await aliceLater.query(api.api.passkeys.step, {})).toBe("verify");
});

test("signing in with only a passkey gives a verified session", async () => {
  const t = testBackend();
  const alice = await signIn(t, "Alice", { passkeyVerified: false });
  const { authenticator } = await enroll(alice.asUser);

  const { options } = await t.mutation(api.api.auth.startAutofillSignInWithUsernamePasskey, {});
  const result = await t.mutation(api.api.passkeys.finishSignIn, {
    response: await authenticator.assert(options),
  });
  if (result.status !== "complete") throw new Error(`Sign-in failed: ${result.userError.error}`);
  const passkeySession = t.withIdentity(sessionIdentity(result.tokens));

  expect(await passkeySession.query(api.api.passkeys.step, {})).toBe("done");
  await passkeySession.mutation(api.api.orgs.create, { name: "Acme" });
});
