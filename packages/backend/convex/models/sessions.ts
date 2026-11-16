import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const listSessions = (ctx: QueryCtx, userId: Id<"users">) =>
  ctx.runQuery(components.auth.public.listSessions, { userId });

export const signOutEverywhere = async (ctx: MutationCtx, userId: Id<"users">) => {
  const sessions = await listSessions(ctx, userId);
  const revoked = await ctx.runMutation(components.auth.public.revokeSessions, {
    sessionIds: sessions.map((session) => session.sessionId),
  });
  return revoked.length;
};
