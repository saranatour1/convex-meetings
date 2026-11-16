import { orgQuery, zPaginationOpts } from "../lib/functions";
import { listAudit } from "../models/audit";

export const list = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => {
    ctx.requirePermission("manageOrganization");
    return listAudit(ctx, orgId, paginationOpts);
  },
});
