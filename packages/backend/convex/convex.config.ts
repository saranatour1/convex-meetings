import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import authPasskey from "@convex-dev/auth/components/passkey/convex.config.js";
import authGoogle from "@convex-dev/auth/components/google/convex.config.js";
import authGithub from "@convex-dev/auth/components/github/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp({
  env: {
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
    AUTH_GITHUB_CLIENT_ID: v.string(),
    AUTH_GITHUB_CLIENT_SECRET: v.string(),
  },
});
app.use(auth);
app.use(authPassword);
app.use(authUsername);
app.use(authPasskey);
// OAuth callbacks are served at <PUBLIC_CONVEX_SITE_URL>/oauth/<provider>/callback.
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

export default app;
