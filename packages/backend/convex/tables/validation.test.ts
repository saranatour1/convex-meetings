import { expect, test } from "vite-plus/test";
import { zTimeOfDay, zTimeZone } from "../lib/time";
import { zSchedule } from "./schedules";
import { zUser } from "./users";

test("bio is trimmed and capped at 280 characters", () => {
  const zBio = zUser.shape.bio.unwrap();
  expect(zBio.parse("  hello  ")).toBe("hello");
  expect(zBio.safeParse("x".repeat(281)).success).toBe(false);
});

test("times of day are HH:mm on a 24-hour clock", () => {
  expect(zTimeOfDay.safeParse("09:30").success).toBe(true);
  expect(zTimeOfDay.safeParse("9:30").success).toBe(false);
  expect(zTimeOfDay.safeParse("24:00").success).toBe(false);
});

test("time zones must be IANA zones", () => {
  expect(zTimeZone.safeParse("Asia/Jerusalem").success).toBe(true);
  expect(zTimeZone.safeParse("Mars/Base").success).toBe(false);
});

test("weekly hours use ISO weekdays and end after they start", () => {
  const zWeeklyHours = zSchedule.shape.weeklyHours;
  expect(zWeeklyHours.safeParse([{ weekday: 1, start: "09:00", end: "17:00" }]).success).toBe(true);
  expect(zWeeklyHours.safeParse([{ weekday: 0, start: "09:00", end: "17:00" }]).success).toBe(
    false,
  );
  expect(zWeeklyHours.safeParse([{ weekday: 1, start: "17:00", end: "09:00" }]).success).toBe(
    false,
  );
});
