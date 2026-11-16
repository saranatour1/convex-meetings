import type { PaginationOptions } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zAuditEvent, type zAuditAction } from "../tables/auditEvents";
import type { z } from "zod";
import { getViewer } from "./users";

export type AuditAction = z.infer<typeof zAuditAction>;

export const audit = (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  actorId: Id<"users">,
  action: AuditAction,
  extra: { targetUserId?: Id<"users">; detail?: string } = {},
) =>
  ctx.db.insert(
    "auditEvents",
    parseOrThrow(zAuditEvent, {
      orgId,
      actorId,
      action,
      ...extra,
      detail: extra.detail?.slice(0, 200),
    }),
  );

export const listAudit = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("auditEvents")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (event) => {
      const [actor, target] = await Promise.all([
        getViewer(ctx, event.actorId),
        event.targetUserId ? getViewer(ctx, event.targetUserId) : null,
      ]);
      return {
        _id: event._id,
        _creationTime: event._creationTime,
        action: event.action,
        detail: event.detail ?? null,
        actorName: actor?.name ?? "Someone",
        targetName: target?.name ?? null,
      };
    }),
  );
  return { ...result, page };
};
