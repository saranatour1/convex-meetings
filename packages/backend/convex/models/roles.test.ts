import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import schema from "../schema";
import { MAX_ROLES_PER_MEMBER, grantedPermissions, mergePermissions } from "./roles";

const modules = import.meta.glob("/convex/**/*.ts");

test("a member holds every permission granted by any of their roles", () => {
  const permissions = mergePermissions([
    { permissions: { createMeetings: true, inviteMembers: false } },
    { permissions: { inviteMembers: true } },
  ]);
  expect([...permissions].sort()).toEqual(["createMeetings", "inviteMembers"]);
});

test("permissions set to false are not granted", () => {
  expect(mergePermissions([{ permissions: { manageRoles: false } }]).size).toBe(0);
});

test("grantedPermissions merges the permissions of every assigned role", async () => {
  const t = convexTest(schema, modules);
  const permissions = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Org" });
    const userId = await ctx.db.insert("users", {
      method: "usernamePasskey",
      isVerified: false,
    });
    const memberId = await ctx.db.insert("members", { orgId, userId });
    const hostRole = await ctx.db.insert("roles", {
      orgId,
      name: "Host",
      permissions: { createMeetings: true },
    });
    const inviterRole = await ctx.db.insert("roles", {
      orgId,
      name: "Inviter",
      permissions: { inviteMembers: true },
    });
    await ctx.db.insert("memberRoles", { orgId, memberId, roleId: hostRole });
    await ctx.db.insert("memberRoles", { orgId, memberId, roleId: inviterRole });
    return [...(await grantedPermissions(ctx, memberId))].sort();
  });
  expect(permissions).toEqual(["createMeetings", "inviteMembers"]);
});

test("grantedPermissions rejects a member holding more than the role limit", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", { name: "Org" });
      const userId = await ctx.db.insert("users", {
        method: "usernamePasskey",
        isVerified: false,
      });
      const memberId = await ctx.db.insert("members", { orgId, userId });
      for (let i = 0; i <= MAX_ROLES_PER_MEMBER; i++) {
        const roleId = await ctx.db.insert("roles", {
          orgId,
          name: `Role ${i}`,
          permissions: { createMeetings: true },
        });
        await ctx.db.insert("memberRoles", { orgId, memberId, roleId });
      }
      return grantedPermissions(ctx, memberId);
    }),
  ).rejects.toThrow("Too many roles");
});
