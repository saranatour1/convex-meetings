import { sessionIdentity, registerCore } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { vi } from "vite-plus/test";
import { components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("/convex/**/*.ts");

export const signedInUser = async (name: string) => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  registerCore(t);
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
  return { t, userId, asUser: t.withIdentity(sessionIdentity(tokens)) };
};
