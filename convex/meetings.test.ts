import { expect, test } from "vite-plus/test";
import { checkMeeting } from "./meetings";

const now = Date.UTC(2026, 10, 15, 12);
const ok = { title: "  Sprint review ", startsAt: now + 3_600_000, durationMinutes: 30 };

test("trims the title and keeps valid meetings", () => {
  expect(checkMeeting(ok, now)).toEqual({ ...ok, title: "Sprint review" });
});

test("allows a start time up to a minute in the past", () => {
  expect(() => checkMeeting({ ...ok, startsAt: now - 30_000 }, now)).not.toThrow();
});

test.each([
  ["empty title", { title: "   " }, "title"],
  ["long title", { title: "x".repeat(201) }, "200"],
  ["odd duration", { durationMinutes: 20 }, "duration"],
  ["past start", { startsAt: now - 5 * 60_000 }, "passed"],
  ["far future", { startsAt: now + 400 * 24 * 3_600_000 }, "next year"],
])("rejects %s", (_, override, message) => {
  expect(() => checkMeeting({ ...ok, ...override }, now)).toThrow(message);
});
