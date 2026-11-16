import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";

export const r2Configured = () =>
  Boolean(
    process.env.R2_BUCKET &&
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY,
  );

export const signedRecordingUrl = (key: string) =>
  new R2(components.r2).getUrl(key, { expiresIn: 60 * 60 });
