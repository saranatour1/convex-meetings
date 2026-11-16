import { DateTime } from "luxon";

export const FOREVER = Number.MAX_SAFE_INTEGER;

const COUNT_WALK_DAYS = 3660;
const WINDOW_WALK_DAYS = 400;
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
const BYDAY_TOKEN = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/;
const UNTIL_FORM = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

type First = { startsAt: number; endsAt: number; timeZone: string };
type Occurrence = { start: number; end: number };

type Rule = {
  freq: (typeof FREQS)[number];
  interval: number;
  byDay: { weekday: number; ordinal?: number }[];
  byMonthDay: number[];
  byMonth: number[];
  count?: number;
  until?: number;
};

const numbers = (raw: string) =>
  raw
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n !== 0);

const parseUntil = (raw: string, timeZone: string) => {
  const match = UNTIL_FORM.exec(raw);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, utc] = match;
  const date = { year: Number(year), month: Number(month), day: Number(day) };
  if (hour === undefined) {
    return DateTime.fromObject(date, { zone: timeZone }).endOf("day").toMillis();
  }
  const time = { hour: Number(hour), minute: Number(minute), second: Number(second) };
  return DateTime.fromObject({ ...date, ...time }, { zone: utc ? "utc" : timeZone }).toMillis();
};

const parseRule = (raw: string | undefined, timeZone: string): Rule | null => {
  if (!raw) return null;
  const pairs = new Map(
    raw.split(";").map((pair) => {
      const [key = "", value = ""] = pair.split("=");
      return [key.trim().toUpperCase(), value.trim().toUpperCase()] as const;
    }),
  );
  const freq = FREQS.find((f) => f === pairs.get("FREQ"));
  if (!freq) return null;
  const interval = Number(pairs.get("INTERVAL") ?? 1);
  const count = pairs.has("COUNT") ? Number(pairs.get("COUNT")) : undefined;
  const byDay = (pairs.get("BYDAY") ?? "")
    .split(",")
    .map((token) => BYDAY_TOKEN.exec(token))
    .filter((match) => match !== null)
    .map(([, ordinal, weekday]) => ({
      weekday: WEEKDAYS.indexOf(weekday!) + 1,
      ordinal: ordinal ? Number(ordinal) : undefined,
    }));
  return {
    freq,
    interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
    byDay,
    byMonthDay: numbers(pairs.get("BYMONTHDAY") ?? ""),
    byMonth: numbers(pairs.get("BYMONTH") ?? ""),
    count: count !== undefined && Number.isInteger(count) && count > 0 ? count : undefined,
    until: pairs.has("UNTIL") ? parseUntil(pairs.get("UNTIL")!, timeZone) : undefined,
  };
};

const calendarDay = (millis: number, timeZone: string) => {
  const local = DateTime.fromMillis(millis, { zone: timeZone });
  return DateTime.utc(local.year, local.month, local.day);
};

const dayIndex = (day: DateTime) => Math.round(day.toMillis() / 86_400_000);
const weekIndex = (day: DateTime) => Math.floor((dayIndex(day) + 3) / 7);
const monthIndex = (day: DateTime) => day.year * 12 + day.month;

const matchesMonthDay = (rule: Rule, day: DateTime, firstDay: DateTime) => {
  const length = day.daysInMonth ?? 31;
  if (rule.byMonthDay.length) {
    return rule.byMonthDay.some((n) => (n > 0 ? n : length + 1 + n) === day.day);
  }
  if (rule.byDay.length) {
    return rule.byDay.some(({ weekday, ordinal }) => {
      if (weekday !== day.weekday) return false;
      if (ordinal === undefined) return true;
      return ordinal > 0
        ? Math.ceil(day.day / 7) === ordinal
        : Math.floor((length - day.day) / 7) + 1 === -ordinal;
    });
  }
  return day.day === firstDay.day;
};

const matches = (rule: Rule, day: DateTime, firstDay: DateTime) => {
  if (day < firstDay) return false;
  if (dayIndex(day) === dayIndex(firstDay)) return true;
  switch (rule.freq) {
    case "DAILY":
      return (dayIndex(day) - dayIndex(firstDay)) % rule.interval === 0;
    case "WEEKLY": {
      const weekdays = rule.byDay.length ? rule.byDay.map((d) => d.weekday) : [firstDay.weekday];
      return (
        (weekIndex(day) - weekIndex(firstDay)) % rule.interval === 0 &&
        weekdays.includes(day.weekday)
      );
    }
    case "MONTHLY":
      return (
        (monthIndex(day) - monthIndex(firstDay)) % rule.interval === 0 &&
        matchesMonthDay(rule, day, firstDay)
      );
    case "YEARLY": {
      const months = rule.byMonth.length ? rule.byMonth : [firstDay.month];
      return (
        (day.year - firstDay.year) % rule.interval === 0 &&
        months.includes(day.month) &&
        matchesMonthDay(rule, day, firstDay)
      );
    }
  }
};

const occurrenceOn = (day: DateTime, first: First): Occurrence => {
  const local = DateTime.fromMillis(first.startsAt, { zone: first.timeZone });
  const start = DateTime.fromObject(
    { year: day.year, month: day.month, day: day.day, hour: local.hour, minute: local.minute },
    { zone: first.timeZone },
  ).toMillis();
  return { start, end: start + (first.endsAt - first.startsAt) };
};

const lastBeforeUntil = (rule: Rule, first: First, until: number) => {
  if (until < first.startsAt) return first.endsAt;
  const firstDay = calendarDay(first.startsAt, first.timeZone);
  const untilDay = calendarDay(until, first.timeZone);
  for (let back = 0; back < COUNT_WALK_DAYS; back++) {
    const day = untilDay.minus({ days: back });
    if (day < firstDay) break;
    if (!matches(rule, day, firstDay)) continue;
    const occurrence = occurrenceOn(day, first);
    if (occurrence.start <= until) return occurrence.end;
  }
  return first.endsAt;
};

const endAfterCount = (rule: Rule, first: First, count: number) => {
  const firstDay = calendarDay(first.startsAt, first.timeZone);
  let seen = 0;
  let last = first.endsAt;
  for (let step = 0; step < COUNT_WALK_DAYS && seen < count; step++) {
    const day = firstDay.plus({ days: step });
    if (!matches(rule, day, firstDay)) continue;
    seen += 1;
    last = occurrenceOn(day, first).end;
  }
  return last;
};

const endOf = (rule: Rule | null, first: First) => {
  if (!rule) return first.endsAt;
  if (rule.until === undefined && rule.count === undefined) return FOREVER;
  return Math.min(
    rule.until === undefined ? FOREVER : lastBeforeUntil(rule, first, rule.until),
    rule.count === undefined ? FOREVER : endAfterCount(rule, first, rule.count),
  );
};

export const lastOccurrenceEnd = (rule: string | undefined, first: First) =>
  endOf(parseRule(rule, first.timeZone), first);

export const occurrencesBetween = (
  rule: string | undefined,
  first: First,
  from: number,
  to: number,
  until?: number,
): Occurrence[] => {
  const parsed = parseRule(rule, first.timeZone);
  if (!parsed) {
    return first.startsAt < to && first.endsAt > from
      ? [{ start: first.startsAt, end: first.endsAt }]
      : [];
  }
  const limit = until ?? endOf(parsed, first);
  const firstDay = calendarDay(first.startsAt, first.timeZone);
  const windowDay = calendarDay(from - (first.endsAt - first.startsAt), first.timeZone);
  const startDay = windowDay < firstDay ? firstDay : windowDay;
  const lastDay = calendarDay(to, first.timeZone);
  const found: Occurrence[] = [];
  for (let step = 0; step < WINDOW_WALK_DAYS; step++) {
    const day = startDay.plus({ days: step });
    if (day > lastDay) break;
    if (!matches(parsed, day, firstDay)) continue;
    const occurrence = occurrenceOn(day, first);
    if (occurrence.end > limit) break;
    if (occurrence.start < to && occurrence.end > from) found.push(occurrence);
  }
  return found;
};
