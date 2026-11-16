import { internalQuery } from "../_generated/server";
import { requireVerifiedUserId } from "../models/passkeys";

export const verifiedUserId = internalQuery({
  args: {},
  handler: (ctx) => requireVerifiedUserId(ctx),
});
