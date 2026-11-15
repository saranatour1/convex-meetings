import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Permission = keyof Doc<"roles">["permissions"];

export const mergePermissions = (roles: Pick<Doc<"roles">, "permissions">[]) =>
  new Set(
    roles.flatMap((role) =>
      Object.entries(role.permissions)
        .filter(([, granted]) => granted)
        .map(([permission]) => permission as Permission),
    ),
  );

export const grantedPermissions = async (ctx: QueryCtx, memberId: Id<"members">) => {
  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_member_and_role", (q) => q.eq("memberId", memberId))
    .take(50);
  const roles = await Promise.all(
    assignments.map((assignment) => ctx.db.get("roles", assignment.roleId)),
  );
  return mergePermissions(roles.filter((role) => role !== null));
};
