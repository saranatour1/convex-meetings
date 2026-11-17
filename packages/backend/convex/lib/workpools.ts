import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const avatarWorkpool = new Workpool(components.avatarWorkpool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
});

export const emailWorkpool = new Workpool(components.emailWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: false,
});

export const moderationWorkpool = new Workpool(components.moderationWorkpool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 4, initialBackoffMs: 500, base: 2 },
});
