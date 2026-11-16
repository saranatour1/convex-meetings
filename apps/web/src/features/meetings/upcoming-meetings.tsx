import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { CalendarPlusIcon, ChevronRightIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { EmptyState } from "#/components/empty-state.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { kindOf } from "./meeting-kinds.ts";

export const UpcomingMeetings = ({ scheduleAction }: { scheduleAction?: ReactNode }) => {
  const meetings = usePaginatedQuery(api.meetings.mine, {}, { initialNumItems: 50 });
  const now = Date.now();
  const zone = browserTimeZone();
  const upcoming = meetings.results
    .filter((m) => m.endsAt > now && m.response !== "declined")
    .sort((a, b) => a.startsAt - b.startsAt);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-sm">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed py-10 md:py-12"
          icon={<CalendarPlusIcon />}
          title="No upcoming meetings"
          description="Meetings you schedule or get invited to will show up here."
          action={scheduleAction}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {upcoming.map((meeting) => (
            <li key={meeting._id}>
              <Link
                to="/meetings/$code"
                params={{ code: meeting.code }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-sm">{meeting.title}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatDate(meeting.startsAt, zone)} · {formatTime(meeting.startsAt, zone)}–
                    {formatTime(meeting.endsAt, zone)} · {kindOf(meeting.kind).label}
                  </span>
                </div>
                {meeting.response === "pending" && (
                  <Badge variant="warning" size="sm">
                    Needs reply
                  </Badge>
                )}
                <ChevronRightIcon className="size-4 opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
