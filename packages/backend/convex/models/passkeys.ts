import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import {
  type AuthenticationResponse,
  type RegistrationResponse,
  toBase64Url,
} from "../lib/webauthn";
import { zVerifiedSession } from "../tables/verifiedSessions";

export const VERIFY_SESSION_PURPOSE = "meetings:verifySession";
const CEREMONY_TIMEOUT_MS = 9 * 60 * 1000;
const SUPPORTED_ALGORITHMS = [-7, -257];

const rpId = () => new URL(env.SITE_URL).hostname;

const signedUpWithOAuth = async (ctx: QueryCtx, userId: Id<"users">) => {
  const method = (await ctx.db.get("users", userId))?.method;
  return method === "google" || method === "github";
};

export const requireSignedIn = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  const identity = await ctx.auth.getUserIdentity();
  if (userId === null || identity === null) throw new ConvexError("Unauthenticated");
  if (!(await signedUpWithOAuth(ctx, userId))) {
    throw new ConvexError("Sign in with Google or GitHub");
  }
  return { userId, sessionId: identity.subject };
};

const isVerified = async (ctx: QueryCtx, sessionId: string) =>
  (await ctx.db
    .query("verifiedSessions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .unique()) !== null;

export const requireVerifiedUserId = async (ctx: QueryCtx) => {
  const { userId, sessionId } = await requireSignedIn(ctx);
  if (!(await isVerified(ctx, sessionId))) throw new ConvexError("Passkey required");
  return userId;
};

export const markVerified = async (ctx: MutationCtx, sessionId: string) => {
  if (await isVerified(ctx, sessionId)) return;
  await ctx.db.insert("verifiedSessions", parseOrThrow(zVerifiedSession, { sessionId }));
};

const passkeyCount = async (ctx: QueryCtx, userId: Id<"users">) =>
  (await ctx.runQuery(components.authPasskey.registration.listPasskeys, { userId })).length;

export const passkeyStep = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  const identity = await ctx.auth.getUserIdentity();
  if (userId === null || identity === null) return null;
  if (!(await signedUpWithOAuth(ctx, userId))) return "oauth";
  if (await isVerified(ctx, identity.subject)) return "done";
  return (await passkeyCount(ctx, userId)) === 0 ? "enroll" : "verify";
};

const enrollOptions = async (ctx: MutationCtx, userId: Id<"users">) => {
  const user = await ctx.db.get("users", userId);
  const { challenge, userHandle, excludeCredentials } = await ctx.runMutation(
    components.authPasskey.registration.startRegistrationForExistingUser,
    { verifiedUserId: userId },
  );
  const name = user?.email ?? user?.name ?? "Meetings";
  return {
    rp: { id: rpId(), name: "Meetings" },
    user: { id: toBase64Url(userHandle), name, displayName: user?.name ?? name },
    challenge: toBase64Url(challenge),
    pubKeyCredParams: SUPPORTED_ALGORITHMS.map((alg) => ({ alg, type: "public-key" as const })),
    timeout: CEREMONY_TIMEOUT_MS,
    excludeCredentials: excludeCredentials.map(({ id }) => ({
      id: toBase64Url(id),
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "required" as const,
      requireResidentKey: true,
      userVerification: "required" as const,
    },
    attestation: "none" as const,
  };
};

const verifyOptions = async (ctx: MutationCtx, userId: Id<"users">) => {
  const { challenge, allowCredentials } = await ctx.runMutation(
    components.authPasskey.authentication.startAuthentication,
    { purpose: VERIFY_SESSION_PURPOSE, userId },
  );
  return {
    challenge: toBase64Url(challenge),
    timeout: CEREMONY_TIMEOUT_MS,
    rpId: rpId(),
    allowCredentials: allowCredentials.map(({ id, transports }) => ({
      id: toBase64Url(id),
      type: "public-key" as const,
      ...(transports ? { transports } : {}),
    })),
    userVerification: "required" as const,
  };
};

export const startPasskeyStep = async (ctx: MutationCtx, userId: Id<"users">) =>
  (await passkeyCount(ctx, userId)) === 0
    ? { step: "enroll" as const, options: await enrollOptions(ctx, userId) }
    : { step: "verify" as const, options: await verifyOptions(ctx, userId) };

export const finishEnroll = async (
  ctx: MutationCtx,
  { userId, sessionId }: { userId: Id<"users">; sessionId: string },
  response: RegistrationResponse,
) => {
  if ((await passkeyCount(ctx, userId)) > 0) throw new ConvexError("You already have a passkey");
  const result = await ctx.runMutation(
    components.authPasskey.registration._internal_dangerous_finishRegistrationForExistingUser,
    {
      expectedRpId: rpId(),
      expectedOrigin: env.SITE_URL,
      verifiedUserId: userId,
      name: "Passkey",
      response,
    },
  );
  if (!result.success) return { error: result.userError.error };
  await markVerified(ctx, sessionId);
  return { error: null };
};

export const finishVerify = async (
  ctx: MutationCtx,
  { userId, sessionId }: { userId: Id<"users">; sessionId: string },
  response: AuthenticationResponse,
) => {
  const result = await ctx.runMutation(components.authPasskey.authentication.finishAuthentication, {
    purpose: VERIFY_SESSION_PURPOSE,
    expectedRpId: rpId(),
    expectedOrigin: env.SITE_URL,
    response,
  });
  if (!result.success) return { error: result.userError.error };
  if (result.userId !== userId) return { error: "PROTOCOL_ERROR" };
  await markVerified(ctx, sessionId);
  return { error: null };
};
