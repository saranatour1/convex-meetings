import { describe, expect, it } from "vite-plus/test";
import { isStorableAvatar } from "./users";

describe("isStorableAvatar", () => {
  it("accepts a small image", () => {
    expect(isStorableAvatar({ type: "image/png", size: 1000 })).toBe(true);
  });

  it("rejects a non-image type", () => {
    expect(isStorableAvatar({ type: "text/html", size: 1000 })).toBe(false);
  });

  it("rejects an image over 5 MB", () => {
    expect(isStorableAvatar({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toBe(false);
  });

  it("rejects an empty image", () => {
    expect(isStorableAvatar({ type: "image/png", size: 0 })).toBe(false);
  });
});
