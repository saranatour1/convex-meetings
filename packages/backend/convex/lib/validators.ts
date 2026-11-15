import { paginationOptsValidator } from "convex/server";
import { convexToZod } from "convex-helpers/server/zod4";
import { z } from "zod";

export const zPaginationOpts = convexToZod(paginationOptsValidator).extend({
  numItems: z.number().int().min(1).max(100),
});
