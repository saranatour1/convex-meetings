import { cityOf, wallToUtc, type Day, type Person, type Share, type Team } from "#/lib/schedule.ts";

type Seed = {
  id: string;
  name: string;
  initials: string;
  city: string;
  timeZone: string;
  work: [number, number];
  share: Share;
  busy?: [number, number][];
  optional?: boolean;
  zoneConflict?: Person["zoneConflict"];
};

function person({ work, busy = [], ...seed }: Seed, day: Day): Person {
  return {
    ...seed,
    workStart: work[0] * 60,
    workEnd: work[1] * 60,
    busy: busy.map(([a, b]) => ({
      start: wallToUtc(day, a * 60, seed.timeZone),
      end: wallToUtc(day, b * 60, seed.timeZone),
    })),
  };
}

const people: Seed[] = [
  {
    id: "lena",
    name: "Lena Fischer",
    initials: "LF",
    city: "Berlin",
    timeZone: "Europe/Berlin",
    work: [9, 17],
    share: "calendar",
    busy: [[15, 16]],
  },
  {
    id: "tomas",
    name: "Tomás Silva",
    initials: "TS",
    city: "Lisbon",
    timeZone: "Europe/Lisbon",
    work: [9, 18],
    share: "calendar",
    busy: [[16.5, 17.5]],
  },
  {
    id: "ana",
    name: "Ana Ribeiro",
    initials: "AR",
    city: "São Paulo",
    timeZone: "America/Sao_Paulo",
    work: [9, 18],
    share: "calendar",
    busy: [
      [10, 11],
      [15, 16],
    ],
  },
  {
    id: "marcus",
    name: "Marcus Lee",
    initials: "ML",
    city: "San Francisco",
    timeZone: "America/Los_Angeles",
    work: [8, 16],
    share: "hours",
    optional: true,
  },
  {
    id: "priya",
    name: "Priya Raman",
    initials: "PR",
    city: "Bengaluru",
    timeZone: "Asia/Kolkata",
    work: [10, 19],
    share: "none",
    zoneConflict: { timeZone: "Europe/London", city: "London" },
  },
];

const finance: Seed[] = [
  {
    id: "dana",
    name: "Dana Brooks",
    initials: "DB",
    city: "New York",
    timeZone: "America/New_York",
    work: [9, 17],
    share: "calendar",
    busy: [[9, 10]],
  },
  {
    id: "grace",
    name: "Grace Kim",
    initials: "GK",
    city: "New York",
    timeZone: "America/New_York",
    work: [9, 17],
    share: "calendar",
    busy: [[15, 16]],
  },
  {
    id: "leo",
    name: "Leo Martins",
    initials: "LM",
    city: "New York",
    timeZone: "America/New_York",
    work: [8, 16],
    share: "hours",
  },
  {
    id: "omar",
    name: "Omar Haddad",
    initials: "OH",
    city: "Toronto",
    timeZone: "America/Toronto",
    work: [9, 17],
    share: "calendar",
    busy: [[9, 9.5]],
  },
  {
    id: "sam",
    name: "Sam Okafor",
    initials: "SO",
    city: "London",
    timeZone: "Europe/London",
    work: [9, 17.5],
    share: "calendar",
  },
  {
    id: "nina",
    name: "Nina Petrova",
    initials: "NP",
    city: "London",
    timeZone: "Europe/London",
    work: [9, 17],
    share: "calendar",
    busy: [[16, 17]],
  },
];

export function sampleInvitees(
  day: Day,
  timeZone: string,
): {
  organizer: Person;
  people: Person[];
  teams: Team[];
} {
  const organizer = person(
    {
      id: "you",
      name: "You",
      initials: "Y",
      city: cityOf(timeZone),
      timeZone,
      work: [9, 17],
      share: "calendar",
      busy: [
        [12, 12.5],
        [14, 15],
      ],
    },
    day,
  );
  return {
    organizer,
    people: people.map((s) => person(s, day)),
    teams: [{ id: "finance", name: "Finance team", members: finance.map((s) => person(s, day)) }],
  };
}
