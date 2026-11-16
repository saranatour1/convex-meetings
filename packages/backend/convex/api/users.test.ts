import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import { api } from "../_generated/api";
import schema from "../schema";
import { signedInUser } from "../../tools/auth-test-setup";

const modules = import.meta.glob("/convex/**/*.ts");

test("viewer is null for a signed-out caller", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.api.users.viewer, {})).toBeNull();
});

test("authed mutations reject a signed-out caller", async () => {
  const t = convexTest(schema, modules);
  await expect(t.mutation(api.api.users.updateBio, { bio: "Hello" })).rejects.toThrow(
    "Unauthenticated",
  );
});

test("a signed-in user can update and read their bio", async () => {
  const { asUser } = await signedInUser("alice");
  await asUser.mutation(api.api.users.updateBio, { bio: "  Hello  " });
  const viewer = await asUser.query(api.api.users.viewer, {});
  expect(viewer).toMatchObject({ bio: "Hello" });
});
