import { sessionIdentity } from "@convex-dev/auth/test";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { testBackend } from "../../tools/auth-test-setup";
import { api } from "../_generated/api";

const account = { username: "Dev.Tester@Example.com", password: "correct horse battery staple" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("email sign-up and sign-in are refused unless the deployment turns them on", async () => {
  const t = testBackend();
  expect(await t.query(api.api.auth.devEmailSignIn, {})).toBe(false);
  await expect(t.mutation(api.api.auth.signUpWithUsernamePassword, account)).rejects.toThrow(
    "only for development",
  );
});

test("on a dev deployment, email accounts sign up and use the app without a passkey", async () => {
  vi.useFakeTimers();
  vi.stubEnv("DEV_EMAIL_SIGN_IN", "true");
  const t = testBackend();
  expect(await t.query(api.api.auth.devEmailSignIn, {})).toBe(true);
  const signedUp = await t.mutation(api.api.auth.signUpWithUsernamePassword, account);
  if (signedUp.status !== "complete") throw new Error(JSON.stringify(signedUp));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const asUser = t.withIdentity(sessionIdentity(signedUp.tokens));
  expect(await asUser.query(api.api.users.viewer, {})).toMatchObject({
    method: "devEmail",
    name: "dev.tester",
    email: "dev.tester@example.com",
    isVerified: false,
  });
  expect(await asUser.query(api.api.passkeys.step, {})).toBe("done");
  await asUser.mutation(api.api.orgs.create, { name: "Dev org" });

  const wrong = await t.mutation(api.api.auth.signInWithUsernamePassword, {
    ...account,
    password: "not the password at all",
  });
  expect(wrong.status).toBe("error");
  const signedIn = await t.mutation(api.api.auth.signInWithUsernamePassword, account);
  expect(signedIn.status).toBe("complete");

  vi.stubEnv("DEV_EMAIL_SIGN_IN", "");
  await expect(asUser.mutation(api.api.orgs.create, { name: "Second org" })).rejects.toThrow(
    "Sign in with Google or GitHub",
  );
  await expect(t.mutation(api.api.auth.signInWithUsernamePassword, account)).rejects.toThrow(
    "only for development",
  );
});
