import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import schema from "../schema";
import { requireMember, requireRole } from "./members";

const modules = import.meta.glob("/convex/**/*.ts");

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Acme" });
    const owner = await ctx.db.insert("users", { method: "usernamePasskey", isVerified: false });
    const outsider = await ctx.db.insert("users", { method: "usernamePasskey", isVerified: false });
    await ctx.db.insert("members", { orgId, userId: owner, role: "owner" });
    return { orgId, owner, outsider };
  });
  return { t, ...ids };
}

test("requireMember returns the membership of a member", async () => {
  const { t, orgId, owner } = await seed();
  const member = await t.run((ctx) => requireMember(ctx, orgId, owner));
  expect(member).toMatchObject({ orgId, userId: owner, role: "owner" });
});

test("requireMember rejects someone outside the org", async () => {
  const { t, orgId, outsider } = await seed();
  await expect(t.run((ctx) => requireMember(ctx, orgId, outsider))).rejects.toThrow("Not a member");
});

test("requireRole allows listed roles and rejects others", async () => {
  const { t, orgId, owner } = await seed();
  const member = await t.run((ctx) => requireMember(ctx, orgId, owner));
  expect(() => requireRole(member, ["owner", "admin"])).not.toThrow();
  expect(() => requireRole(member, ["admin"])).toThrow("Not allowed");
});
