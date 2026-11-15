import { expect, test } from "vite-plus/test";
import { zSchedule } from "./schedules";
import { zBio } from "./users";

const zWeeklyHours = zSchedule.shape.weeklyHours;

test("bio is trimmed and capped at 280 characters", () => {
  expect(zBio.parse("  hello  ")).toBe("hello");
  expect(zBio.safeParse("x".repeat(281)).success).toBe(false);
});

test("an available range must end after it starts", () => {
  expect(zWeeklyHours.safeParse([{ weekday: "mon", start: "09:00", end: "17:00" }]).success).toBe(
    true,
  );
  expect(zWeeklyHours.safeParse([{ weekday: "mon", start: "17:00", end: "09:00" }]).success).toBe(
    false,
  );
  expect(zWeeklyHours.safeParse([{ weekday: "mon", start: "9:00", end: "17:00" }]).success).toBe(
    false,
  );
});
