import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupGithub } from "@convex-dev/auth/methods/github/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { components, internal } from "../_generated/api";
import { env } from "../_generated/server";
import { publicQuery } from "../lib/functions";
import { devEmailSignInOn } from "../models/passkeys";

const userCallbacks = internal.internal.users;
const allowedRedirectOrigins = [env.SITE_URL];

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(auth, {
  component: components.authGoogle,
  allowedRedirectOrigins,
}).attachUserCallbacks({ createUser: userCallbacks.createGoogleUser });

export const { startSignInWithGithub, completeSignInWithGithub } = setupGithub(auth, {
  component: components.authGithub,
  allowedRedirectOrigins,
}).attachUserCallbacks({ createUser: userCallbacks.createGithubUser });

export const { signUpWithUsernamePassword, signInWithUsernamePassword } = setupUsernamePassword(
  auth,
  { component: components.authPassword, usernameComponent: components.authUsername },
).attachUserCallbacks({
  createUser: userCallbacks.createDevUser,
  onSignIn: userCallbacks.checkDevSignIn,
});

export const devEmailSignIn = publicQuery({
  args: {},
  handler: () => devEmailSignInOn(),
});
