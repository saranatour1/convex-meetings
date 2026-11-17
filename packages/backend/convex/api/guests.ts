import { z } from "zod";
import { publicMutation, publicQuery } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";
import { previewGuestPass, previewMeeting, renameGuest } from "../models/guests";
import { enterOrAskAsGuest } from "../models/joinRequests";
import { zUser } from "../tables/users";
const zName = zUser.shape.name.unwrap();

export const preview = publicQuery({
  args: { code: z.string().max(20) },
  handler: (ctx, { code }) => previewMeeting(ctx, code),
});

export const pass = publicQuery({
  args: { secret: z.string().max(100) },
  handler: (ctx, { secret }) => previewGuestPass(ctx, secret),
});

export const enter = publicMutation({
  args: { code: z.string().max(20), name: zName },
  handler: async (ctx, { code, name }) => {
    await enforceRateLimit(ctx, "guestEnter", code);
    return enterOrAskAsGuest(ctx, code, name);
  },
});

export const rename = publicMutation({
  args: { secret: z.string().max(100), name: zName },
  handler: (ctx, { secret, name }) => renameGuest(ctx, secret, name),
});
