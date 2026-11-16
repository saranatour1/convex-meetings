export type Day = string;
export type Interval = { start: number; end: number };
export type Share = "calendar" | "hours" | "none";

export type Person = {
  id: string;
  name: string;
  initials: string;
  city: string;
  timeZone: string;
  zoneConflict?: { timeZone: string; city: string };
  workStart: number;
  workEnd: number;
  share: Share;
  busy: Interval[];
  optional?: boolean;
};

export type Team = { id: string; name: string; members: Person[] };

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

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions, locale = "en-US") {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    formatters.set(key, f);
  }
  return f;
}

function wallClock(ms: number, timeZone: string) {
  const parts = formatter(timeZone, {
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function wallMinutes(ms: number, timeZone: string): number {
  const w = wallClock(ms, timeZone);
  return w.hour * 60 + w.minute;
}

export function offsetMinutes(ms: number, timeZone: string): number {
  const w = wallClock(ms, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - ms) / MINUTE);
}

export function wallToUtc(day: Day, minutes: number, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offsetMinutes(guess, timeZone) * MINUTE;
  return guess - offsetMinutes(first, timeZone) * MINUTE;
}

export function dayOf(ms: number, timeZone: string): Day {
  const w = wallClock(ms, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function isWeekend(day: Day): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function nextWorkday(day: Day): Day {
  return isWeekend(day) ? nextWorkday(addDays(day, 1)) : day;
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseZones(value: unknown): string[] | undefined {
  const zones = (Array.isArray(value) ? value : [value]).filter(isTimeZone);
  return zones.length ? [...new Set(zones)] : undefined;
}

export function mondayOf(day: Day): Day {
  return addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
}

export const formatTime = (ms: number, timeZone: string) =>
  formatter(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB").format(ms);

export const formatWeekday = (ms: number, timeZone: string) =>
  formatter(timeZone, { weekday: "short" }).format(ms);

export const formatDate = (ms: number, timeZone: string) =>
  formatter(timeZone, { weekday: "short", month: "short", day: "numeric" }).format(ms);

export const formatLongDate = (ms: number, timeZone: string) =>
  formatter(timeZone, { month: "short", day: "numeric", year: "numeric" }).format(ms);

export function nextClockChange(after: number, timeZone: string, days = 400): number | null {
  const offset = offsetMinutes(after, timeZone);
  const start = dayOf(after, timeZone);
  for (let i = 1; i <= days; i++) {
    const noon = wallToUtc(addDays(start, i), 12 * 60, timeZone);
    if (offsetMinutes(noon, timeZone) !== offset) return noon;
  }
  return null;
}

export function formatOffset(ms: number, timeZone: string): string {
  const m = offsetMinutes(ms, timeZone);
  const h = Math.floor(Math.abs(m) / 60);
  const r = Math.abs(m) % 60;
  return `UTC${m < 0 ? "−" : "+"}${h}${r ? `:${String(r).padStart(2, "0")}` : ""}`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export const cityOf = (timeZone: string) =>
  (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");

export function workingIntervals(p: Person, from: number, to: number): Interval[] {
  const first = addDays(dayOf(from, p.timeZone), -1);
  const out: Interval[] = [];
  for (let i = 0; i < 3; i++) {
    const day = addDays(first, i);
    if (isWeekend(day)) continue;
    const iv = {
      start: wallToUtc(day, p.workStart, p.timeZone),
      end: wallToUtc(day, p.workEnd, p.timeZone),
    };
    if (iv.end > from && iv.start < to) out.push(iv);
  }
  return out;
}

export function nextMidnight(p: Person, after: number): number {
  return wallToUtc(addDays(dayOf(after, p.timeZone), 1), 0, p.timeZone);
}

export function statusAt(p: Person, start: number, end: number): Status {
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

  if (isWeekend(dayOf(start, p.timeZone))) return { kind: "out", label: "Weekend" };
  const hour = wallClock(start, p.timeZone).hour;
  if (hour >= 5 && hour < 9) return { kind: "out", label: "Early morning" };
  if (hour >= 17 && hour < 22) return { kind: "out", label: "Evening" };
  if (hour >= 22 || hour < 5) return { kind: "out", label: "Night" };
  return { kind: "out", label: "Outside working hours" };
}

function stretchMinutes(p: Person, start: number, end: number): number {
  if (statusAt(p, start, end).kind === "free") return 0;
  const hours = workingIntervals(p, start - 12 * HOUR, end + 12 * HOUR);
  const gaps = hours.map((h) => Math.max(0, h.start - start, end - h.end) / MINUTE);
  return Math.min(180, ...gaps);
}

export function availability(
  everyone: Person[],
  day: Day,
  timeZone: string,
  minutes: number,
  window: [number, number] = [7, 19],
): Plan {
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
}

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

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const dayParts = (day: Day) => day.split("-").map(Number) as [number, number, number];
const weekdayOf = (day: Day) => new Date(`${day}T00:00:00Z`).getUTCDay();
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

function monthlyMatch(rule: RepeatRule, day: Day, firstDay: number): boolean {
  const [y, m, d] = dayParts(day);
  const ordinals = rule.byDay?.filter((b) => b.ordinal !== undefined) ?? [];
  if (ordinals.length) {
    const fromEnd = -Math.ceil((daysInMonth(y, m) - d + 1) / 7);
    return ordinals.some(
      (b) =>
        WEEKDAY_CODES.indexOf(b.weekday) === weekdayOf(day) &&
        (b.ordinal === Math.ceil(d / 7) || b.ordinal === fromEnd),
    );
  }
  return (rule.byMonthDay ?? [firstDay]).includes(d);
}

export function repeatDays(first: Day, rule: RepeatRule, horizonDays = 366): Day[] {
  const interval = rule.interval ?? 1;
  const [y0, m0, d0] = dayParts(first);
  const sinceMonday = (weekdayOf(first) + 6) % 7;
  const weekdays = rule.byDay?.filter((b) => b.ordinal === undefined).map((b) => b.weekday);
  const onWeekday = (day: Day, fallback: boolean) =>
    weekdays?.length ? weekdays.includes(WEEKDAY_CODES[weekdayOf(day)]) : fallback;
  const until = rule.until
    ? `${rule.until.year}-${String(rule.until.month).padStart(2, "0")}-${String(rule.until.day).padStart(2, "0")}`
    : null;

  const days: Day[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const day = addDays(first, i);
    if (until && day > until) break;
    const [y, m, d] = dayParts(day);
    const matches =
      rule.freq === "DAILY"
        ? i % interval === 0 && onWeekday(day, true)
        : rule.freq === "WEEKLY"
          ? Math.floor((i + sinceMonday) / 7) % interval === 0 &&
            onWeekday(day, weekdayOf(day) === weekdayOf(first))
          : rule.freq === "MONTHLY"
            ? ((y - y0) * 12 + (m - m0)) % interval === 0 && monthlyMatch(rule, day, d0)
            : (y - y0) % interval === 0 && m === m0 && d === d0;
    if (!matches) continue;
    days.push(day);
    if (rule.count && days.length >= rule.count) break;
  }
  return days;
}

export function clockShifts(people: Person[], starts: number[]): ClockShift[] {
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
}
