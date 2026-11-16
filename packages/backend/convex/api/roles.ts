import { zid } from "convex-helpers/server/zod4";
import { orgMutation } from "../lib/functions";
import { audit } from "../models/audit";
import { actorOf, createRole, deleteRole, updateRole } from "../models/orgs";
import { zRole } from "../tables/roles";

export const create = orgMutation({
  args: { name: zRole.shape.name, permissions: zRole.shape.permissions },
  handler: async (ctx, { orgId, name, permissions }) => {
    ctx.requirePermission("manageRoles");
    const roleId = await createRole(ctx, orgId, actorOf(ctx), name, permissions);
    await audit(ctx, orgId, ctx.userId, "roleCreated", { detail: name });
    return roleId;
  },
});

export const update = orgMutation({
  args: {
    roleId: zid("roles"),
    name: zRole.shape.name.optional(),
    permissions: zRole.shape.permissions.optional(),
  },
  handler: async (ctx, { orgId, roleId, ...changes }) => {
    ctx.requirePermission("manageRoles");
    await updateRole(ctx, orgId, actorOf(ctx), roleId, changes);
    const role = await ctx.db.get("roles", roleId);
    await audit(ctx, orgId, ctx.userId, "roleUpdated", { detail: role?.name });
  },
});

export const remove = orgMutation({
  args: { roleId: zid("roles") },
  handler: async (ctx, { orgId, roleId }) => {
    ctx.requirePermission("manageRoles");
    const role = await deleteRole(ctx, orgId, actorOf(ctx), roleId);
    await audit(ctx, orgId, ctx.userId, "roleDeleted", { detail: role.name });
  },
});
