import { expect, test } from "vite-plus/test";
import { zMeeting } from "../tables/meetings";
import { zUser } from "../tables/users";
import { parseOrThrow } from "./validate";

test("parseOrThrow returns the trimmed value", () => {
  expect(parseOrThrow(zMeeting.shape.title, "  Standup  ")).toBe("Standup");
});

test("parseOrThrow rejects an empty title", () => {
  expect(() => parseOrThrow(zMeeting.shape.title, "")).toThrow();
});

test("parseOrThrow rejects a bio over the length limit", () => {
  expect(() => parseOrThrow(zUser.shape.bio.unwrap(), "x".repeat(281))).toThrow();
});
