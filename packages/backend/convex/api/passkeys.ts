import { publicQuery, signedInMutation } from "../lib/functions";
import { zAuthenticationResponse, zRegistrationResponse } from "../lib/webauthn";
import {
  finishEnroll as finishEnrollPasskey,
  finishVerify as finishVerifyPasskey,
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
