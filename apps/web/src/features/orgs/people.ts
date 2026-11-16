import type { FunctionReturnType } from "convex/server";
import type { api } from "@meetings/backend";
import { getInitials } from "#/lib/initials.ts";
import { cityOf, formatOffset, type Person } from "#/lib/schedule.ts";

export type Member = FunctionReturnType<typeof api.members.list>["page"][number];

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const memberToPerson = (member: Member, now: number): Person => {
  const timeZone = member.schedule?.timeZone ?? member.seenTimeZone ?? "UTC";
  const seen = member.seenTimeZone;
  const elsewhere =
    member.schedule && seen && formatOffset(now, seen) !== formatOffset(now, timeZone);
  return {
    id: member.userId,
    name: member.name,
    initials: getInitials(member.name),
    city: cityOf(timeZone),
    timeZone,
    zoneConflict: elsewhere && seen ? { timeZone: seen, city: cityOf(seen) } : undefined,
    hours:
      member.schedule?.weeklyHours.map((h) => ({
        weekday: h.weekday,
        start: toMinutes(h.start),
        end: toMinutes(h.end),
      })) ?? [],
    share: member.schedule ? "hours" : "none",
    busy: [],
    verified: member.isVerified,
  };
};
