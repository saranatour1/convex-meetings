import { track } from "@databuddy/sdk";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { CalendarPlusIcon, CheckIcon, ChevronRightIcon, VideoIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import { EmptyState } from "#/components/empty-state.tsx";
import { LiveDot } from "#/components/live-dot.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { showError } from "#/lib/errors.ts";
import {
  addDays,
  dayOf,
  formatAgo,
  formatDate,
  formatDayHeading,
  formatTime,
} from "#/lib/schedule.ts";
import { JOIN_EARLY, countdown, useMinute } from "./clock.ts";
import { kindOf } from "./meeting-kinds.ts";
import { MeetingRow, type MyMeeting } from "./meeting-row.tsx";
import { useConvexPages } from "#/features/data/live-query.ts";

const peopleInCall = (meeting: MyMeeting) => meeting.lastSession?.inCall ?? 0;

export const isLive = (meeting: MyMeeting) =>
  meeting.endedAt === null && meeting.response !== "declined" && peopleInCall(meeting) > 0;

const Name = ({ meeting }: { meeting: MyMeeting }) => (
  <span className="flex min-w-0 items-center gap-2 font-medium text-sm">
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", kindOf(meeting.kind).dot)} />
    <span className="truncate">{meeting.title}</span>
  </span>
);

const Details = ({ children }: { children: ReactNode }) => (
  <span className="ps-4 text-muted-foreground text-xs tabular-nums">{children}</span>
);

const JoinButton = ({ code }: { code: string }) => (
  <Button
    size="sm"
    variant="outline"
    render={<Link to="/meetings/$code" params={{ code }} search={{ call: true }} />}
  >
    <VideoIcon />
    Join
  </Button>
);

const MeetingLink = ({ meeting, children }: { meeting: MyMeeting; children: ReactNode }) => (
  <Link
    to="/meetings/$code"
    params={{ code: meeting.code }}
    className="flex min-w-0 flex-1 basis-56 items-center gap-3"
  >
    {children}
  </Link>
);

const Row = ({ children }: { children: ReactNode }) => (
  <li className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/40">{children}</li>
);

const List = ({ children }: { children: ReactNode }) => (
  <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">{children}</ul>
);

const Section = ({
  title,
  more,
  children,
}: {
  title: ReactNode;
  more?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <div className="flex min-h-7 items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold text-sm">{title}</h2>
      {more}
    </div>
    {children}
  </section>
);

const LiveRow = ({ meeting }: { meeting: MyMeeting }) => (
  <Row>
    <MeetingLink meeting={meeting}>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <Name meeting={meeting} />
          <Badge variant="success" size="sm">
            LIVE
          </Badge>
        </span>
        <Details>
          {kindOf(meeting.kind).label} · started {formatAgo(meeting.lastSession?.startedAt ?? 0)} ·{" "}
          {peopleInCall(meeting)} in the call
        </Details>
      </span>
    </MeetingLink>
    <JoinButton code={meeting.code} />
  </Row>
);

const ReplyRow = ({ meeting, zone }: { meeting: MyMeeting; zone: string }) => {
  const respond = useMutation(api.meetings.respond);
  const reply = (response: "accepted" | "declined") =>
    void respond({ meetingId: meeting._id, response })
      .then(() => track("meeting_responded", { response }))
      .catch(showError);

  return (
    <Row>
      <MeetingLink meeting={meeting}>
        <span className="flex min-w-0 flex-col">
          <Name meeting={meeting} />
          <Details>
            {formatDate(meeting.startsAt, zone)} · {formatTime(meeting.startsAt, zone)}–
            {formatTime(meeting.endsAt, zone)} · {kindOf(meeting.kind).label}
          </Details>
        </span>
      </MeetingLink>
      <div className="flex gap-1.5" role="group" aria-label={`Reply to ${meeting.title}`}>
        <Button size="sm" variant="outline" onClick={() => reply("accepted")}>
          <CheckIcon />
          Going
        </Button>
        <Button size="sm" variant="ghost" onClick={() => reply("declined")}>
          Not going
        </Button>
      </div>
    </Row>
  );
};

const UpcomingRow = ({ meeting, now, zone }: { meeting: MyMeeting; now: number; zone: string }) => {
  const soon = meeting.startsAt - now <= JOIN_EARLY;

  return (
    <Row>
      <MeetingLink meeting={meeting}>
        <span className="flex w-11 shrink-0 flex-col tabular-nums">
          <span className="font-medium text-sm">{formatTime(meeting.startsAt, zone)}</span>
          <span className="text-muted-foreground text-xs">{formatTime(meeting.endsAt, zone)}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <Name meeting={meeting} />
          <Details>
            {kindOf(meeting.kind).label}
            {meeting.rrule && " · repeats"}
          </Details>
        </span>
      </MeetingLink>
      {soon ? (
        <span className="flex items-center gap-2">
          <Badge variant="warning" size="sm">
            {countdown(meeting.startsAt, now)}
          </Badge>
          <JoinButton code={meeting.code} />
        </span>
      ) : (
        <ChevronRightIcon aria-hidden className="size-4 opacity-50" />
      )}
    </Row>
  );
};

const byDay = (meetings: MyMeeting[], zone: string) => {
  const days = new Map<string, MyMeeting[]>();
  for (const meeting of meetings) {
    const day = dayOf(meeting.startsAt, zone);
    days.set(day, [...(days.get(day) ?? []), meeting]);
  }
  return [...days.entries()];
};

export const UpcomingMeetings = () => {
  const meetings = useConvexPages(api.meetings.mine, {}, { initialNumItems: 100 });
  const now = useMinute();
  const zone = browserTimeZone();
  const today = dayOf(now, zone);
  const dayLabel = (day: string, ms: number) =>
    day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : formatDayHeading(ms, zone);

  const live = meetings.results.filter(isLive);
  const future = meetings.results
    .filter((m) => m.endedAt === null && m.response !== "declined")
    .filter((m) => m.endsAt > now && peopleInCall(m) === 0)
    .sort((a, b) => a.startsAt - b.startsAt);
  const needsReply = future.filter((m) => m.response === "pending");
  const upcoming = future.filter((m) => m.response !== "pending").slice(0, 8);
  const recaps = meetings.results
    .filter((m) => m.lastSession?.hasSummary)
    .sort((a, b) => (b.lastSession?.startedAt ?? 0) - (a.lastSession?.startedAt ?? 0))
    .slice(0, 5);

  if (meetings.status === "LoadingFirstPage") return null;
  if (!live.length && !future.length && !recaps.length) {
    return (
      <EmptyState
        className="rounded-2xl border border-dashed py-10 md:py-12"
        icon={<CalendarPlusIcon />}
        title="Nothing coming up"
        description="Calls you start, join or get invited to show up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {live.length > 0 && (
        <Section
          title={
            <>
              <LiveDot />
              Live now
            </>
          }
        >
          <List>
            {live.map((meeting) => (
              <LiveRow key={meeting._id} meeting={meeting} />
            ))}
          </List>
        </Section>
      )}

      <div
        className={cn(
          "grid items-start gap-8",
          recaps.length > 0 && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <div className="flex flex-col gap-8">
          {needsReply.length > 0 && (
            <Section title="Needs your reply">
              <List>
                {needsReply.map((meeting) => (
                  <ReplyRow key={meeting._id} meeting={meeting} zone={zone} />
                ))}
              </List>
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section
              title="Coming up"
              more={
                <Button size="sm" variant="ghost" render={<Link to="/meetings" />}>
                  All meetings
                </Button>
              }
            >
              {byDay(upcoming, zone).map(([day, group]) => (
                <div key={day} className="flex flex-col gap-2 pt-1">
                  <h3 className="font-medium text-muted-foreground text-xs">
                    {dayLabel(day, group[0]!.startsAt)}
                  </h3>
                  <List>
                    {group.map((meeting) => (
                      <UpcomingRow key={meeting._id} meeting={meeting} now={now} zone={zone} />
                    ))}
                  </List>
                </div>
              ))}
            </Section>
          )}
        </div>

        {recaps.length > 0 && (
          <Section
            title="Recent recaps"
            more={
              <Button
                size="sm"
                variant="ghost"
                render={<Link to="/meetings" search={{ tab: "past" }} />}
              >
                Past meetings
              </Button>
            }
          >
            <List>
              {recaps.map((meeting) => (
                <MeetingRow key={meeting._id} meeting={meeting} past />
              ))}
            </List>
          </Section>
        )}
      </div>
    </div>
  );
};
