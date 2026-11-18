import { Link } from "@tanstack/react-router";

import { CalendarPlusIcon, HistoryIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import { EmptyState } from "#/components/empty-state.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { dayOf, formatLongDate, formatWeekday } from "#/lib/schedule.ts";
import { MeetingRow, type MyMeeting } from "./meeting-row.tsx";
import { useConvexPages } from "#/features/data/live-query.ts";

export type MeetingsTab = "upcoming" | "past";

const byDay = (meetings: MyMeeting[]) => {
  const zone = browserTimeZone();
  const groups = new Map<string, MyMeeting[]>();
  for (const meeting of meetings) {
    const day = dayOf(meeting.startsAt, zone);
    groups.set(day, [...(groups.get(day) ?? []), meeting]);
  }
  return [...groups.values()];
};

export const MeetingsList = ({ tab }: { tab: MeetingsTab }) => {
  const meetings = useConvexPages(api.meetings.mine, {}, { initialNumItems: 100 });
  const now = Date.now();
  const zone = browserTimeZone();
  const past = tab === "past";
  const shown = meetings.results
    .filter((m) => (past ? m.endsAt <= now || m.lastSession !== null : m.endsAt > now))
    .sort((a, b) => (past ? b.startsAt - a.startsAt : a.startsAt - b.startsAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-xl">Meetings</h1>
        <Button size="sm" variant="outline" render={<Link to="/schedule" />}>
          <CalendarPlusIcon />
          Schedule
        </Button>
      </div>
      <nav className="flex gap-1 border-b">
        {(["upcoming", "past"] as const).map((value) => (
          <Link
            key={value}
            to="/meetings"
            search={{ tab: value === "past" ? "past" : undefined }}
            className={cn(
              "-mb-px border-transparent border-b-2 px-3 py-2 text-muted-foreground text-sm capitalize hover:text-foreground",
              tab === value && "border-foreground text-foreground",
            )}
          >
            {value}
          </Link>
        ))}
      </nav>
      {meetings.status !== "LoadingFirstPage" && shown.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed py-10"
          icon={past ? <HistoryIcon /> : <CalendarPlusIcon />}
          title={past ? "No past meetings yet" : "Nothing coming up"}
          description={
            past
              ? "Meetings you've had show up here with their recaps and recordings."
              : "Meetings you schedule or get invited to show up here."
          }
        />
      ) : (
        byDay(shown).map((group) => (
          <section key={group[0]!._id} className="flex flex-col gap-2">
            <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {formatWeekday(group[0]!.startsAt, zone)} · {formatLongDate(group[0]!.startsAt, zone)}
            </h2>
            <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">
              {group.map((meeting) => (
                <MeetingRow key={meeting._id} meeting={meeting} past={past} />
              ))}
            </ul>
          </section>
        ))
      )}
      {meetings.status === "CanLoadMore" && (
        <Button variant="ghost" size="sm" onClick={() => meetings.loadMore(100)}>
          Show older meetings
        </Button>
      )}
    </div>
  );
};
