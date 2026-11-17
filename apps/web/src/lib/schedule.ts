import { DateTime } from "luxon";

export type Day = string;
export type Interval = { start: number; end: number };
export type Share = "calendar" | "hours" | "none";
export type WorkHours = { weekday: number; start: number; end: number };

export type Person = {
  id: string;
  name: string;
  initials: string;
  city: string;
  timeZone: string;
  zoneConflict?: { timeZone: string; city: string };
  hours: WorkHours[];
  share: Share;
  busy: Interval[];
  verified?: boolean;
  optional?: boolean;
};

export type StatusKind = "free" | "busy" | "stretch" | "out";
export type Status = { kind: StatusKind; label: string };

export type Slot = { start: number; free: number; stretch: number };
export type Plan = { from: number; to: number; slots: Slot[]; best: Slot[] };

export type ClockShift = {
  start: number;
  changes: { person: Person; from: string; to: string }[];
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
const STRETCH_LIMIT = 90 * MINUTE;
const LOCALE = "en-US";

const at = (ms: number, timeZone: string) =>
  DateTime.fromMillis(ms, { zone: timeZone, locale: LOCALE });

const calendarDay = (day: Day, timeZone = "utc") =>
  DateTime.fromISO(day, { zone: timeZone, locale: LOCALE });

export const isoWeekday = (day: Day) => calendarDay(day).weekday;

export const wallMinutes = (ms: number, timeZone: string) => {
  const time = at(ms, timeZone);
  return time.hour * 60 + time.minute;
};

export const offsetMinutes = (ms: number, timeZone: string) => at(ms, timeZone).offset;

export const wallToUtc = (day: Day, minutes: number, timeZone: string) =>
  calendarDay(day, timeZone)
    .plus({ days: Math.floor(minutes / 1440) })
    .set({ hour: Math.floor((minutes % 1440) / 60), minute: minutes % 60 })
    .toMillis();

export const dayOf = (ms: number, timeZone: string): Day => at(ms, timeZone).toISODate() ?? "";

export const addDays = (day: Day, n: number): Day =>
  calendarDay(day).plus({ days: n }).toISODate() ?? day;

export const isWeekend = (day: Day) => isoWeekday(day) >= 6;

export const nextWorkday = (day: Day): Day => (isWeekend(day) ? nextWorkday(addDays(day, 1)) : day);

export const mondayOf = (day: Day): Day => calendarDay(day).startOf("week").toISODate() ?? day;

export const formatTime = (ms: number, timeZone: string) => at(ms, timeZone).toFormat("HH:mm");

export const formatWeekday = (ms: number, timeZone: string) => at(ms, timeZone).toFormat("ccc");

export const formatDate = (ms: number, timeZone: string) => at(ms, timeZone).toFormat("ccc, LLL d");

export const formatDayHeading = (ms: number, timeZone: string) =>
  at(ms, timeZone).toFormat("cccc d LLLL");

export const formatLongDate = (ms: number, timeZone: string) =>
  at(ms, timeZone).toFormat("LLL d, yyyy");

export const nextClockChange = (after: number, timeZone: string, days = 400) => {
  const offset = offsetMinutes(after, timeZone);
  const start = dayOf(after, timeZone);
  for (let i = 1; i <= days; i++) {
    const noon = wallToUtc(addDays(start, i), 12 * 60, timeZone);
    if (offsetMinutes(noon, timeZone) !== offset) return noon;
  }
  return null;
};

export const formatOffset = (ms: number, timeZone: string) => {
  const m = offsetMinutes(ms, timeZone);
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  return `UTC${m < 0 ? "−" : "+"}${h}${r ? `:${String(r).padStart(2, "0")}` : ""}`;
};

export const formatDuration = (ms: number) => {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

export const cityOf = (timeZone: string) =>
  (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");

export const workingIntervals = (p: Person, from: number, to: number) => {
  const first = addDays(dayOf(from, p.timeZone), -1);
  const out: Interval[] = [];
  for (let i = 0; i < 3; i++) {
    const day = addDays(first, i);
    const weekday = isoWeekday(day);
    for (const h of p.hours) {
      if (h.weekday !== weekday) continue;
      const iv = {
        start: wallToUtc(day, h.start, p.timeZone),
        end: wallToUtc(day, h.end, p.timeZone),
      };
      if (iv.end > from && iv.start < to) out.push(iv);
    }
  }
  return out;
};

export const nextMidnight = (p: Person, after: number) =>
  wallToUtc(addDays(dayOf(after, p.timeZone), 1), 0, p.timeZone);

export const statusAt = (p: Person, start: number, end: number): Status => {
  const hours = workingIntervals(p, start - 2 * HOUR, end + 2 * HOUR);
  const inHours = hours.some((h) => start >= h.start && end <= h.end);
  const busy = p.share === "calendar" && p.busy.some((b) => start < b.end && end > b.start);
  if (inHours && busy) return { kind: "busy", label: "Busy" };
  if (inHours) {
    return { kind: "free", label: p.share === "calendar" ? "Free" : "In working hours" };
  }

  const early = hours.map((h) => h.start - start).filter((d) => d > 0 && d <= STRETCH_LIMIT);
  if (early.length) {
    return {
      kind: "stretch",
      label: `${formatDuration(Math.min(...early))} before their day starts`,
    };
  }
  const late = hours.map((h) => end - h.end).filter((d) => d > 0 && d <= STRETCH_LIMIT);
  if (late.length) {
    return { kind: "stretch", label: `${formatDuration(Math.min(...late))} after their day ends` };
  }

  const day = dayOf(start, p.timeZone);
  if (!p.hours.some((h) => h.weekday === isoWeekday(day))) {
    return { kind: "out", label: isWeekend(day) ? "Weekend" : "Day off" };
  }
  const hour = at(start, p.timeZone).hour;
  if (hour >= 5 && hour < 9) return { kind: "out", label: "Early morning" };
  if (hour >= 17 && hour < 22) return { kind: "out", label: "Evening" };
  if (hour >= 22 || hour < 5) return { kind: "out", label: "Night" };
  return { kind: "out", label: "Outside working hours" };
};

const stretchMinutes = (p: Person, start: number, end: number) => {
  if (statusAt(p, start, end).kind === "free") return 0;
  const hours = workingIntervals(p, start - 12 * HOUR, end + 12 * HOUR);
  const gaps = hours.map((h) => Math.max(0, h.start - start, end - h.end) / MINUTE);
  return Math.min(180, ...gaps);
};

export const availability = (
  everyone: Person[],
  day: Day,
  timeZone: string,
  minutes: number,
  window: [number, number] = [7, 19],
): Plan => {
  const from = wallToUtc(day, window[0] * 60, timeZone);
  const to = wallToUtc(day, window[1] * 60, timeZone);
  const length = minutes * MINUTE;
  const slots: Slot[] = [];
  for (let t = from; t < to; t += 30 * MINUTE) {
    slots.push({
      start: t,
      free: everyone.filter((p) => statusAt(p, t, t + length).kind === "free").length,
      stretch: everyone.reduce((sum, p) => sum + stretchMinutes(p, t, t + length), 0),
    });
  }
  const best = [...slots].sort(
    (a, b) => b.free - a.free || a.stretch - b.stretch || a.start - b.start,
  );
  return { from, to, slots, best };
};

export const snapTo = (ms: number, minutes: number) =>
  Math.round(ms / (minutes * MINUTE)) * minutes * MINUTE;

export type RepeatRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number;
  byDay?: { weekday: string; ordinal?: number }[];
  byMonthDay?: number[];
  count?: number;
  until?: { year: number; month: number; day: number };
};

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const weekdayCode = (day: Day) => WEEKDAY_CODES[isoWeekday(day) - 1];

const monthlyMatch = (rule: RepeatRule, day: DateTime, firstDay: number) => {
  const ordinals = rule.byDay?.filter((b) => b.ordinal !== undefined) ?? [];
  if (ordinals.length) {
    const fromEnd = -Math.ceil(((day.daysInMonth ?? 31) - day.day + 1) / 7);
    return ordinals.some(
      (b) =>
        b.weekday === WEEKDAY_CODES[day.weekday - 1] &&
        (b.ordinal === Math.ceil(day.day / 7) || b.ordinal === fromEnd),
    );
  }
  return (rule.byMonthDay ?? [firstDay]).includes(day.day);
};

export const repeatDays = (first: Day, rule: RepeatRule, horizonDays = 366) => {
  const interval = rule.interval ?? 1;
  const start = calendarDay(first);
  const sinceMonday = start.weekday - 1;
  const weekdays = rule.byDay?.filter((b) => b.ordinal === undefined).map((b) => b.weekday);
  const onWeekday = (day: Day, fallback: boolean) =>
    weekdays?.length ? weekdays.includes(weekdayCode(day)) : fallback;
  const until = rule.until ? DateTime.fromObject(rule.until, { zone: "utc" }).toISODate() : null;

  const days: Day[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = start.plus({ days: i });
    const day = date.toISODate() ?? first;
    if (until && day > until) break;
    const months = (date.year - start.year) * 12 + (date.month - start.month);
    const matches =
      rule.freq === "DAILY"
        ? i % interval === 0 && onWeekday(day, true)
        : rule.freq === "WEEKLY"
          ? Math.floor((i + sinceMonday) / 7) % interval === 0 &&
            onWeekday(day, date.weekday === start.weekday)
          : rule.freq === "MONTHLY"
            ? months % interval === 0 && monthlyMatch(rule, date, start.day)
            : (date.year - start.year) % interval === 0 &&
              date.month === start.month &&
              date.day === start.day;
    if (!matches) continue;
    days.push(day);
    if (rule.count && days.length >= rule.count) break;
  }
  return days;
};

export const clockShifts = (people: Person[], starts: number[]) => {
  const shifts: ClockShift[] = [];
  for (let k = 1; k < starts.length; k++) {
    const changes = people.flatMap((person) => {
      const from = formatTime(starts[k - 1], person.timeZone);
      const to = formatTime(starts[k], person.timeZone);
      return from === to ? [] : [{ person, from, to }];
    });
    if (changes.length) shifts.push({ start: starts[k], changes });
  }
  return shifts;
};

export const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${clock}` : clock;
};

export const formatAgo = (ms: number) => DateTime.fromMillis(ms).toRelative() ?? "just now";
