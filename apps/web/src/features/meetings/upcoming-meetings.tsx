import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { CalendarPlusIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { EmptyState } from "#/components/empty-state.tsx";
import { MeetingRow, type MyMeeting } from "./meeting-row.tsx";

const Section = ({
  title,
  meetings,
  past,
  more,
}: {
  title: string;
  meetings: MyMeeting[];
  past?: boolean;
  more?: ReactNode;
}) =>
  meetings.length ? (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">{title}</h2>
        {more}
      </div>
      <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {meetings.map((meeting) => (
          <MeetingRow key={meeting._id} meeting={meeting} past={past} />
        ))}
      </ul>
    </section>
  ) : null;

export const UpcomingMeetings = ({ scheduleAction }: { scheduleAction?: ReactNode }) => {
  const meetings = usePaginatedQuery(api.meetings.mine, {}, { initialNumItems: 100 });
  const now = Date.now();
  const future = meetings.results
    .filter((m) => m.endsAt > now && m.response !== "declined")
    .sort((a, b) => a.startsAt - b.startsAt);
  const needsReply = future.filter((m) => m.response === "pending");
  const upcoming = future.filter((m) => m.response !== "pending").slice(0, 8);
  const recaps = meetings.results
    .filter((m) => m.lastSession?.hasSummary)
    .sort((a, b) => (b.lastSession?.startedAt ?? 0) - (a.lastSession?.startedAt ?? 0))
    .slice(0, 5);

  if (meetings.status === "LoadingFirstPage") return null;
  if (!future.length && !recaps.length) {
    return (
      <EmptyState
        className="rounded-xl border border-dashed py-10 md:py-12"
        icon={<CalendarPlusIcon />}
        title="No upcoming meetings"
        description="Meetings you schedule or get invited to will show up here."
        action={scheduleAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="Needs your reply" meetings={needsReply} />
      <Section
        title="Upcoming"
        meetings={upcoming}
        more={
          <Button size="sm" variant="ghost" render={<Link to="/meetings" />}>
            All meetings
          </Button>
        }
      />
      <Section
        title="Recent recaps"
        meetings={recaps}
        past
        more={
          <Button
            size="sm"
            variant="ghost"
            render={<Link to="/meetings" search={{ tab: "past" }} />}
          >
            Past meetings
          </Button>
        }
      />
    </div>
  );
};
