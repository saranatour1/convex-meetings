import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import authPasskey from "@convex-dev/auth/components/passkey/convex.config.js";
import authGoogle from "@convex-dev/auth/components/google/convex.config.js";
import authGithub from "@convex-dev/auth/components/github/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import cloudflareEmail from "@sarant/cloudflare-email-component/convex.config.js";
import r2 from "@convex-dev/r2/convex.config.js";

const app = defineApp({
  env: {
    SITE_URL: v.string(),
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
    AUTH_GITHUB_CLIENT_ID: v.string(),
    AUTH_GITHUB_CLIENT_SECRET: v.string(),
    CLOUDFLARE_ACCOUNT_ID: v.optional(v.string()),
    CLOUDFLARE_API_TOKEN: v.optional(v.string()),
    EMAIL_FROM: v.optional(v.string()),
    REALTIMEKIT_APP_ID: v.optional(v.string()),
    REALTIMEKIT_API_TOKEN: v.optional(v.string()),
    RECORDINGS_PATH: v.optional(v.string()),
  },
});
app.use(auth);
app.use(authPassword);
app.use(authUsername);
app.use(authPasskey);
app.use(authGoogle, {
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
});
app.use(authGithub, {
  httpPrefix: "/oauth/github",
  env: {
    CLIENT_ID: app.env.AUTH_GITHUB_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GITHUB_CLIENT_SECRET,
  },
});
app.use(workpool, { name: "avatarWorkpool" });
app.use(workpool, { name: "emailWorkpool" });
app.use(r2);
app.use(cloudflareEmail, {
  env: {
    CLOUDFLARE_ACCOUNT_ID: app.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: app.env.CLOUDFLARE_API_TOKEN,
  },
});

export default app;
