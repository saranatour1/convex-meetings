import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function requireMember(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_org_and_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!member) throw new ConvexError("Not a member");
  return member;
}

export function requireRole(member: Doc<"members">, allowed: Doc<"members">["role"][]) {
  if (!allowed.includes(member.role)) throw new ConvexError("Not allowed");
}
