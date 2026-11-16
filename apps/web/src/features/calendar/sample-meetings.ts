import { formatInstant, type CalEvent, type EventColor } from "@meetings/ui/kloq";
import { MINUTE, addDays, dayOf, mondayOf, wallToUtc } from "#/lib/schedule.ts";

type Seed = {
  id: string;
  title: string;
  weekday: number;
  at: number;
  minutes: number;
  color: EventColor;
  rrule?: string;
  busy?: boolean;
};

const seeds: Seed[] = [
  {
    id: "standup",
    title: "Standup",
    weekday: 0,
    at: 9.5,
    minutes: 15,
    color: "blue",
    rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  },
  {
    id: "finance-sync",
    title: "Weekly finance sync",
    weekday: 0,
    at: 16,
    minutes: 30,
    color: "violet",
    rrule: "FREQ=WEEKLY",
  },
  { id: "q4-review", title: "Q4 budget review", weekday: 1, at: 10.5, minutes: 45, color: "amber" },
  {
    id: "design-review",
    title: "Design review",
    weekday: 2,
    at: 14,
    minutes: 60,
    color: "emerald",
  },
  {
    id: "ana-1-1",
    title: "1:1 with Ana",
    weekday: 3,
    at: 15,
    minutes: 30,
    color: "rose",
    rrule: "FREQ=WEEKLY;INTERVAL=2",
  },
  { id: "focus", title: "Focus time", weekday: 4, at: 9, minutes: 120, color: "blue", busy: false },
];

export const sampleMeetings = (timeZone: string): CalEvent[] => {
  const monday = mondayOf(dayOf(Date.now(), timeZone));
  return seeds.map(({ weekday, at, minutes, ...seed }) => {
    const start = wallToUtc(addDays(monday, weekday), at * 60, timeZone);
    return {
      ...seed,
      start: formatInstant(new Date(start), timeZone),
      end: formatInstant(new Date(start + minutes * MINUTE), timeZone),
      timeZone,
    };
  });
};
