import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const avatarWorkpool = new Workpool(components.avatarWorkpool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
});
