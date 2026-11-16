import { zid } from "convex-helpers/server/zod4";
import { orgMutation } from "../lib/functions";
import { createRole, deleteRole, updateRole } from "../models/orgs";
import { zRole } from "../tables/roles";

export const create = orgMutation({
  args: { name: zRole.shape.name, permissions: zRole.shape.permissions },
  handler: (ctx, { orgId, name, permissions }) => {
    ctx.requirePermission("manageRoles");
    return createRole(ctx, orgId, name, permissions);
  },
});

export const update = orgMutation({
  args: {
    roleId: zid("roles"),
    name: zRole.shape.name.optional(),
    permissions: zRole.shape.permissions.optional(),
  },
  handler: (ctx, { orgId, roleId, ...changes }) => {
    ctx.requirePermission("manageRoles");
    return updateRole(ctx, orgId, roleId, changes);
  },
});

export const remove = orgMutation({
  args: { roleId: zid("roles") },
  handler: (ctx, { orgId, roleId }) => {
    ctx.requirePermission("manageRoles");
    return deleteRole(ctx, orgId, roleId);
  },
});
