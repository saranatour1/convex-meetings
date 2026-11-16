import type { FinishSignInResult } from "@convex-dev/auth/methods/username-passkey/server";
import { api } from "../_generated/api";
import { publicMutation, publicQuery, signedInMutation } from "../lib/functions";
import {
  accessTokenSessionId,
  zAuthenticationResponse,
  zRegistrationResponse,
} from "../lib/webauthn";
import {
  finishEnroll as finishEnrollPasskey,
  finishVerify as finishVerifyPasskey,
  markVerified,
  passkeyStep,
  startPasskeyStep,
} from "../models/passkeys";

export const step = publicQuery({
  args: {},
  handler: (ctx) => passkeyStep(ctx),
});

export const start = signedInMutation({
  args: {},
  handler: (ctx) => startPasskeyStep(ctx, ctx.userId),
});

export const finishEnroll = signedInMutation({
  args: { response: zRegistrationResponse },
  handler: (ctx, { response }) => finishEnrollPasskey(ctx, ctx, response),
});

export const finishVerify = signedInMutation({
  args: { response: zAuthenticationResponse },
  handler: (ctx, { response }) => finishVerifyPasskey(ctx, ctx, response),
});

export const finishSignIn = publicMutation({
  args: { response: zAuthenticationResponse },
  handler: async (ctx, { response }): Promise<FinishSignInResult> => {
    const result: FinishSignInResult = await ctx.runMutation(
      api.api.auth.finishSignInWithUsernamePasskey,
      {
        response,
      },
    );
    if (result.status === "complete") {
      await markVerified(ctx, accessTokenSessionId(result.tokens.accessToken));
    }
    return result;
  },
});
