import { sessionIdentity, registerCore } from "@convex-dev/auth/test";
import { register as registerWorkpool } from "@convex-dev/workpool/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { register as registerEmail } from "@sarant/cloudflare-email-component/test";
import { convexTest } from "convex-test";
import { vi } from "vite-plus/test";
import { components } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("/convex/**/*.ts");

export const testBackend = () => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  registerCore(t);
  registerWorkpool(t, "avatarWorkpool");
  registerWorkpool(t, "emailWorkpool");
  registerEmail(t);
  registerRateLimiter(t);
  return t;
};

type TestBackend = ReturnType<typeof testBackend>;

export const signIn = async (t: TestBackend, name: string) => {
  const { userId, tokens } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name,
      method: "usernamePassword",
      isVerified: false,
    });
    const tokens = await ctx.runMutation(components.auth.public._internal_dangerous_signIn, {
      claims: { method: "test", profile: {} },
      componentPath: "test",
      userId,
      accessTokenTtlSeconds: 3600,
      refreshInactivityTimeoutSeconds: 86400,
      sessionMaxLifetimeSeconds: 86400,
    });
    return { userId, tokens };
  });
  return { userId, asUser: t.withIdentity(sessionIdentity(tokens)) };
};

export const signedInUser = async (name: string) => {
  const t = testBackend();
  return { t, ...(await signIn(t, name)) };
};

export const addOrgMember = (
  t: TestBackend,
  orgId: Id<"organizations">,
  userId: Id<"users">,
  roleName?: string,
) =>
  t.run(async (ctx) => {
    const memberId = await ctx.db.insert("members", { orgId, userId });
    if (roleName) {
      const role = await ctx.db
        .query("roles")
        .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("name", roleName))
        .unique();
      if (!role) throw new Error(`No role named ${roleName}`);
      await ctx.db.insert("memberRoles", { orgId, memberId, roleId: role._id });
    }
    return memberId;
  });
