import { DateTime } from "luxon";
import { expect, test } from "vite-plus/test";
import { FOREVER, lastOccurrenceEnd, occurrencesBetween } from "./recurrence";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const meetingAt = (iso: string, timeZone = "UTC", minutes = 30) => {
  const startsAt = DateTime.fromISO(iso, { zone: timeZone }).toMillis();
  return { startsAt, endsAt: startsAt + minutes * 60_000, timeZone };
};

const localStarts = (rule: string | undefined, first: ReturnType<typeof meetingAt>, to: number) =>
  occurrencesBetween(rule, first, first.startsAt, to).map((o) =>
    DateTime.fromMillis(o.start, { zone: first.timeZone }).toFormat("yyyy-MM-dd HH:mm"),
  );

test("weekly on Tuesday keeps 09:00 local across the end of summer time", () => {
  const first = meetingAt("2026-10-20T09:00", "Europe/Berlin");
  const found = occurrencesBetween(
    "FREQ=WEEKLY;BYDAY=TU",
    first,
    first.startsAt,
    first.startsAt + 15 * DAY,
  );
  expect(
    found.map((o) =>
      DateTime.fromMillis(o.start, { zone: "Europe/Berlin" }).toFormat("yyyy-MM-dd HH:mm"),
    ),
  ).toEqual(["2026-10-20 09:00", "2026-10-27 09:00", "2026-11-03 09:00"]);
  expect(found.map((o) => o.start)).toEqual([
    Date.UTC(2026, 9, 20, 7),
    Date.UTC(2026, 9, 27, 8),
    Date.UTC(2026, 10, 3, 8),
  ]);
  expect(found.every((o) => o.end - o.start === 30 * 60_000)).toBe(true);
});

test("weekdays repeat five times a week", () => {
  const first = meetingAt("2026-11-16T09:00");
  expect(localStarts("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", first, first.startsAt + 7 * DAY)).toEqual([
    "2026-11-16 09:00",
    "2026-11-17 09:00",
    "2026-11-18 09:00",
    "2026-11-19 09:00",
    "2026-11-20 09:00",
  ]);
});

test("monthly on the last Friday", () => {
  const first = meetingAt("2026-11-27T15:00");
  expect(localStarts("FREQ=MONTHLY;BYDAY=-1FR", first, Date.UTC(2027, 2, 1))).toEqual([
    "2026-11-27 15:00",
    "2026-12-25 15:00",
    "2027-01-29 15:00",
    "2027-02-26 15:00",
  ]);
});

test("every other week skips the weeks in between", () => {
  const first = meetingAt("2026-11-18T09:00");
  expect(localStarts("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE", first, first.startsAt + 35 * DAY)).toEqual([
    "2026-11-18 09:00",
    "2026-12-02 09:00",
    "2026-12-16 09:00",
  ]);
});

test("COUNT stops after that many occurrences", () => {
  const first = meetingAt("2026-11-16T09:00");
  expect(localStarts("FREQ=DAILY;COUNT=3", first, first.startsAt + 10 * DAY)).toEqual([
    "2026-11-16 09:00",
    "2026-11-17 09:00",
    "2026-11-18 09:00",
  ]);
  expect(lastOccurrenceEnd("FREQ=DAILY;COUNT=3", first)).toBe(first.endsAt + 2 * DAY);
});

test("UNTIL excludes later dates", () => {
  const first = meetingAt("2026-11-16T09:00");
  expect(localStarts("FREQ=DAILY;UNTIL=20261118", first, first.startsAt + 10 * DAY)).toEqual([
    "2026-11-16 09:00",
    "2026-11-17 09:00",
    "2026-11-18 09:00",
  ]);
  expect(lastOccurrenceEnd("FREQ=DAILY;UNTIL=20261118T000000Z", first)).toBe(first.endsAt + DAY);
});

test("without a rule only the first meeting counts", () => {
  const first = meetingAt("2026-11-16T09:00");
  expect(lastOccurrenceEnd(undefined, first)).toBe(first.endsAt);
  expect(
    occurrencesBetween(undefined, first, first.startsAt - HOUR, first.startsAt + HOUR),
  ).toEqual([{ start: first.startsAt, end: first.endsAt }]);
  expect(occurrencesBetween(undefined, first, first.endsAt, first.endsAt + DAY)).toEqual([]);
});

test("an unknown FREQ behaves as no rule", () => {
  const first = meetingAt("2026-11-16T09:00");
  expect(lastOccurrenceEnd("FREQ=HOURLY", first)).toBe(first.endsAt);
  expect(localStarts("FREQ=HOURLY", first, first.startsAt + 3 * DAY)).toEqual(["2026-11-16 09:00"]);
});

test("a rule without an end repeats forever", () => {
  expect(lastOccurrenceEnd("FREQ=WEEKLY;BYDAY=WE", meetingAt("2026-11-18T09:00"))).toBe(FOREVER);
});

test("yearly on the third Wednesday of November", () => {
  const first = meetingAt("2026-11-18T09:00");
  const rule = "FREQ=YEARLY;BYMONTH=11;BYDAY=3WE";
  const inNovember = (year: number) =>
    occurrencesBetween(rule, first, Date.UTC(year, 10, 1), Date.UTC(year, 11, 1)).map((o) =>
      DateTime.fromMillis(o.start, { zone: "UTC" }).toFormat("yyyy-MM-dd HH:mm"),
    );
  expect(inNovember(2026)).toEqual(["2026-11-18 09:00"]);
  expect(inNovember(2027)).toEqual(["2027-11-17 09:00"]);
  expect(inNovember(2028)).toEqual(["2028-11-15 09:00"]);
  expect(occurrencesBetween(rule, first, Date.UTC(2027, 0, 1), Date.UTC(2027, 10, 1))).toEqual([]);
});

test("yearly on a month day", () => {
  const first = meetingAt("2026-11-18T09:00");
  expect(
    occurrencesBetween(
      "FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=18",
      first,
      Date.UTC(2027, 10, 1),
      Date.UTC(2027, 11, 1),
    ),
  ).toEqual([{ start: first.startsAt + 365 * DAY, end: first.endsAt + 365 * DAY }]);
});
