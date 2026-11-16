import { expect, test } from "vite-plus/test";
import { parseRRule } from "@meetings/ui/kloq/rrule";
import {
  MINUTE,
  availability,
  clockShifts,
  dayOf,
  formatOffset,
  nextClockChange,
  repeatDays,
  snapTo,
  formatTime,
  statusAt,
  wallToUtc,
  type Person,
  type RepeatRule,
} from "./schedule.ts";

const person = (timeZone: string, workStart: number, workEnd: number): Person => ({
  id: timeZone,
  name: timeZone,
  initials: "",
  city: "",
  timeZone,
  workStart,
  workEnd,
  share: "calendar",
  busy: [],
});

const NY = "America/New_York";
const berlin = person("Europe/Berlin", 9 * 60, 17 * 60);
const sf = person("America/Los_Angeles", 8 * 60, 16 * 60);

test("one New York wall time reads correctly everywhere, before and after clocks change", () => {
  const nov = wallToUtc("2026-11-17", 10 * 60 + 30, NY);
  expect(new Date(nov).toISOString()).toBe("2026-11-17T15:30:00.000Z");
  expect(formatTime(nov, "Europe/Berlin")).toBe("16:30");
  expect(formatTime(nov, "Asia/Kolkata")).toBe("21:00");
  expect(formatOffset(nov, "Asia/Kolkata")).toBe("UTC+5:30");
  expect(formatOffset(nov, NY)).toBe("UTC−5");

  const mar = wallToUtc("2027-03-16", 10 * 60 + 30, NY);
  expect(formatTime(mar, "Europe/Berlin")).toBe("15:30");
  expect(formatTime(mar, "Asia/Kolkata")).toBe("20:00");

  expect(dayOf(nextClockChange(nov, NY) ?? 0, NY)).toBe("2027-03-14");
  expect(dayOf(nextClockChange(nov, "Europe/Berlin") ?? 0, NY)).toBe("2027-03-28");
  expect(nextClockChange(nov, "Asia/Kolkata")).toBeNull();
});

test("status, best slot and weekly clock changes", () => {
  const start = wallToUtc("2026-11-17", 10 * 60 + 30, NY);
  const end = start + 30 * MINUTE;
  expect(statusAt(berlin, start, end).kind).toBe("free");
  expect(statusAt(sf, start, end)).toEqual({
    kind: "stretch",
    label: "30 min before their day starts",
  });

  const plan = availability([person(NY, 9 * 60, 17 * 60), berlin], "2026-11-17", NY, 30);
  expect(plan.slots).toHaveLength(24);
  expect(formatTime(plan.best[0].start, NY)).toBe("09:00");
  expect(plan.best[0].free).toBe(2);

  expect(new Date(snapTo(start + 7 * MINUTE, 5)).toISOString()).toBe("2026-11-17T15:35:00.000Z");

  const weekly = repeatDays("2026-11-17", { freq: "WEEKLY" }).map((d) =>
    wallToUtc(d, 10 * 60 + 30, NY),
  );
  const shifts = clockShifts([berlin, sf], weekly);
  expect(shifts.map((s) => new Date(s.start).toISOString().slice(0, 10))).toEqual([
    "2027-03-16",
    "2027-03-30",
    "2027-11-02",
    "2027-11-09",
  ]);
  expect(shifts[0].changes.map((c) => [c.from, c.to])).toEqual([["16:30", "15:30"]]);
});

test("repeat rules from the RRULE editor expand on the right days", () => {
  const days = (rule: string, horizon = 366) =>
    repeatDays("2026-11-17", parseRRule(rule) as RepeatRule, horizon);

  expect(days("FREQ=DAILY;INTERVAL=2;COUNT=3")).toEqual(["2026-11-17", "2026-11-19", "2026-11-21"]);
  expect(days("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=4")).toEqual([
    "2026-11-17",
    "2026-11-19",
    "2026-12-01",
    "2026-12-03",
  ]);
  expect(days("FREQ=MONTHLY;INTERVAL=2;BYDAY=3TU", 130)).toEqual([
    "2026-11-17",
    "2027-01-19",
    "2027-03-16",
  ]);
  expect(days("FREQ=MONTHLY;BYDAY=-1TU", 80)).toEqual(["2026-11-24", "2026-12-29", "2027-01-26"]);
  expect(days("FREQ=WEEKLY;UNTIL=20261201")).toEqual(["2026-11-17", "2026-11-24", "2026-12-01"]);
  expect(days("FREQ=YEARLY;COUNT=5", 400)).toEqual(["2026-11-17", "2027-11-17"]);
});
