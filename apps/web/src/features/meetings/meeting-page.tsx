import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useMutation } from "convex/react";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckIcon,
  CopyIcon,
  DoorClosedIcon,
  EllipsisIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@meetings/ui/components/menu";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@meetings/ui/components/tabs";
import { cn } from "@meetings/ui/lib/utils";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { roomLink } from "#/features/rooms/room-link.ts";
import { browserTimeZone } from "#/lib/browser.ts";
import { copyWithToast, showError } from "#/lib/errors.ts";
import { cityOf, dayOf, formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";
import type { CallSide } from "./call/call-ui.ts";
import { JoinCallButton, MeetingCall, MeetingEnded } from "./call-entry.tsx";
import { JOIN_EARLY, countdown, useMinute } from "./clock.ts";
import { MeetingDoor, MeetingSettingsCard, meetingLink } from "./meeting-access.tsx";
import { MeetingChat } from "./meeting-chat.tsx";
import { TranscriptFeed } from "./transcript-feed.tsx";
import { kindOf } from "./meeting-kinds.ts";
import { type MeetingDetails, MeetingPeople, othersInCall } from "./meeting-people.tsx";
import type { MeetingTab } from "./meeting-search.ts";
import { JoinRequests } from "./join-requests.tsx";
import { useConvexValue } from "#/features/data/live-query.ts";

type Session = MeetingDetails["sessions"][number];

const sessionSummary = (session: Session, zone: string) =>
  [
    `${formatDate(session.startedAt, zone)} · ${formatTime(session.startedAt, zone)}${
      session.endedAt ? `–${formatTime(session.endedAt, zone)}` : ""
    }`,
    session.endedAt && (formatDuration(session.endedAt - session.startedAt) || "under a minute"),
    `${session.attendees} joined`,
  ]
    .filter(Boolean)
    .join(" · ");

const Status = ({ meeting, now }: { meeting: MeetingDetails; now: number }) => {
  if (meeting.endedAt) return <Badge variant="outline">Ended</Badge>;
  if (meeting.sessions.some((session) => session.endedAt === null)) {
    return <Badge variant="success">LIVE</Badge>;
  }
  const time = meeting.access === "public" ? null : meeting.time;
  if (!time || time.endsAt <= now || time.startsAt - now > JOIN_EARLY) return null;
  return <Badge variant="warning">{countdown(time.startsAt, now)}</Badge>;
};

const HostMenu = ({
  meeting,
  room,
  onCancelled,
}: {
  meeting: MeetingDetails;
  room: boolean;
  onCancelled: () => void;
}) => {
  const cancel = useMutation(api.meetings.cancel);
  const closeRoom = useMutation(api.rooms.close);

  return (
    <Menu>
      <MenuTrigger render={<Button size="icon-lg" variant="outline" aria-label="More actions" />}>
        <EllipsisIcon />
      </MenuTrigger>
      <MenuPopup align="end">
        {room && !meeting.endedAt && (
          <MenuItem
            onClick={() =>
              void closeRoom({ meetingId: meeting._id })
                .then(() => track("room_closed"))
                .catch(showError)
            }
          >
            <DoorClosedIcon />
            Close room
          </MenuItem>
        )}
        <MenuItem
          variant="destructive"
          onClick={() =>
            void cancel({ meetingId: meeting._id })
              .then(() => {
                track("meeting_cancelled");
                onCancelled();
              })
              .catch(showError)
          }
        >
          <XIcon />
          {room ? "Delete room" : "Cancel meeting"}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
};

const Reply = ({ meeting }: { meeting: MeetingDetails }) => {
  const respond = useMutation(api.meetings.respond);
  const options = [
    { response: "accepted", label: "Going" },
    { response: "declined", label: "Not going" },
  ] as const;

  return (
    <div role="group" aria-label="Your reply" className="flex gap-1.5">
      {options.map(({ response, label }) => {
        const chosen = meeting.me.response === response;
        return (
          <Button
            key={response}
            size="lg"
            variant={chosen ? "secondary" : "outline"}
            aria-pressed={chosen}
            onClick={() =>
              void respond({ meetingId: meeting._id, response })
                .then(() => track("meeting_responded", { response }))
                .catch(showError)
            }
          >
            {chosen && <CheckIcon />}
            {label}
          </Button>
        );
      })}
    </div>
  );
};

const LastCall = ({
  meeting,
  session,
  room,
  zone,
}: {
  meeting: MeetingDetails;
  session: Session;
  room: boolean;
  zone: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Last call</CardTitle>
      <CardDescription className="tabular-nums">{sessionSummary(session, zone)}</CardDescription>
    </CardHeader>
    <CardPanel className="flex flex-col gap-3">
      <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground text-sm">
        {session.summary ??
          (meeting.recap
            ? "The summary shows up a few minutes after the call ends."
            : "Transcripts and summaries are off for this meeting.")}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        render={
          <Link
            to={room ? "/rooms/$code/recaps/$number" : "/meetings/$code/recaps/$number"}
            params={{ code: meeting.code, number: session.number }}
          />
        }
      >
        Open recap
        <ArrowRightIcon />
      </Button>
    </CardPanel>
  </Card>
);

const Recaps = ({
  meeting,
  room,
  zone,
}: {
  meeting: MeetingDetails;
  room: boolean;
  zone: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Recaps</CardTitle>
      <CardDescription>
        {meeting.recap
          ? "Summaries arrive a few minutes after a call ends. Links last 7 days."
          : "Transcripts and summaries are off for this meeting."}
      </CardDescription>
    </CardHeader>
    <CardPanel>
      <ul className="flex flex-col divide-y">
        {meeting.sessions.map((session) => (
          <li key={session._id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <Link
              to={room ? "/rooms/$code/recaps/$number" : "/meetings/$code/recaps/$number"}
              params={{ code: meeting.code, number: session.number }}
              className="font-medium text-sm tabular-nums underline-offset-4 hover:underline"
            >
              {sessionSummary(session, zone)}
            </Link>
            {session.summary && (
              <p className="whitespace-pre-wrap text-muted-foreground text-sm">{session.summary}</p>
            )}
            <div className="flex gap-3 text-muted-foreground text-xs">
              {session.endedAt === null && <span>In progress</span>}
              {session.hasTranscript && <span>Transcript</span>}
              {session.hasRecording && (
                <span className="flex items-center gap-1">
                  <VideoIcon className="size-3.5" />
                  Recording
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </CardPanel>
  </Card>
);

type MeetingPageProps = {
  code: string;
  onCancelled: () => void;
  inCall: boolean;
  onInCallChange: (inCall: boolean) => void;
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  tab?: MeetingTab;
  onTabChange: (tab: MeetingTab | undefined) => void;
};

export const MeetingPage = ({
  code,
  onCancelled,
  inCall,
  onInCallChange,
  side,
  onSideChange,
  expanded,
  onExpandedChange,
  tab,
  onTabChange,
}: MeetingPageProps) => {
  const meeting = useConvexValue(api.meetings.get, { code });
  const now = useMinute();
  if (meeting === undefined) return <LoadingScreen />;
  if (meeting === null) return <MeetingDoor code={code} />;

  const zone = browserTimeZone();
  const room = meeting.access === "public";
  const time = room ? null : meeting.time;
  const isHost = meeting.me.role === "host";
  const link = room ? roomLink(meeting.code) : meetingLink(meeting.code);
  const lastCall = meeting.sessions.find((session) => session.endedAt !== null);
  const sideColumn = meeting.me.canControl || lastCall;
  const hidden = (tab === "recaps" && !meeting.sessions.length) || (tab === "transcript" && room);
  const current = hidden ? "overview" : (tab ?? "overview");

  return (
    <div className="flex flex-col gap-6">
      {meeting.me.canControl && !inCall && (
        <JoinRequests meetingId={meeting._id} className="rounded-lg p-3" />
      )}

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  room ? "bg-muted-foreground" : kindOf(meeting.kind).dot,
                )}
              />
              {room ? "Public room" : kindOf(meeting.kind).label}
            </Badge>
            <Status meeting={meeting} now={now} />
            {isHost && <Badge variant="outline">You're hosting</Badge>}
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">{meeting.title}</h1>
          {time && (
            <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm tabular-nums">
              <CalendarClockIcon className="size-4" />
              {dayOf(time.startsAt, zone) === dayOf(now, zone)
                ? "Today"
                : formatDate(time.startsAt, zone)}{" "}
              · {formatTime(time.startsAt, zone)}–{formatTime(time.endsAt, zone)}
              {time.timeZone !== zone &&
                ` · ${formatTime(time.startsAt, time.timeZone)} in ${cityOf(time.timeZone)}`}
              {time.rrule && " · repeats"}
            </p>
          )}
          <div className="flex min-w-0 items-center gap-1">
            <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
              {meeting.code}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void copyWithToast(link, room ? "Public link copied" : "Meeting link copied")
              }
            >
              <CopyIcon />
              Copy link
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isHost && !room && <Reply meeting={meeting} />}
          {isHost && <HostMenu meeting={meeting} room={room} onCancelled={onCancelled} />}
          {!meeting.endedAt && !inCall && <JoinCallButton onJoin={() => onInCallChange(true)} />}
        </div>
      </header>

      {meeting.endedAt && <MeetingEnded endedAt={meeting.endedAt} room={room} />}
      {inCall && !meeting.endedAt && (
        <Suspense fallback={<Button disabled>Loading call…</Button>}>
          <MeetingCall
            meetingId={meeting._id}
            code={meeting.code}
            title={meeting.title}
            kind={meeting.kind}
            inCall={inCall}
            onInCallChange={onInCallChange}
            side={side}
            onSideChange={onSideChange}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            canControl={meeting.me.canControl}
            devicesInCall={meeting.me.devicesInCall}
            isProtected={meeting.protected}
            moderated={room}
            peopleInCall={othersInCall(meeting)}
            recap={meeting.recap}
          />
        </Suspense>
      )}

      <Tabs
        value={current}
        onValueChange={(value: string) =>
          onTabChange(value === "overview" ? undefined : (value as MeetingTab))
        }
        className="gap-4"
      >
        <TabsList variant="underline" className="w-full justify-start border-b">
          <TabsTab value="overview" className="grow-0">
            Overview
          </TabsTab>
          <TabsTab value="chat" className="grow-0">
            Chat
          </TabsTab>
          {!room && (
            <TabsTab value="transcript" className="grow-0">
              Transcript
            </TabsTab>
          )}
          {meeting.sessions.length > 0 && (
            <TabsTab value="recaps" className="grow-0 gap-1.5">
              Recaps
              <Badge variant="secondary" size="sm" className="tabular-nums">
                {meeting.sessions.length}
              </Badge>
            </TabsTab>
          )}
        </TabsList>

        <TabsPanel value="overview">
          <div
            className={cn(
              "grid items-start gap-6",
              sideColumn && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
            )}
          >
            <MeetingPeople meeting={meeting} room={room} />
            {sideColumn && (
              <div className="flex flex-col gap-6">
                {meeting.me.canControl && (
                  <MeetingSettingsCard
                    meetingId={meeting._id}
                    access={meeting.access}
                    inviters={meeting.inviters}
                    isProtected={meeting.protected}
                    slowModeSeconds={meeting.slowModeSeconds}
                    waitingRoom={meeting.waitingRoom}
                    liveText={meeting.liveText}
                  />
                )}
                {lastCall && (
                  <LastCall meeting={meeting} session={lastCall} room={room} zone={zone} />
                )}
              </div>
            )}
          </div>
        </TabsPanel>

        <TabsPanel value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>
                {room
                  ? "Everyone in this public room sees it."
                  : "Only people invited to this meeting see it."}
              </CardDescription>
            </CardHeader>
            <CardPanel>
              <MeetingChat className="h-[32rem]" meetingId={meeting._id} />
            </CardPanel>
          </Card>
        </TabsPanel>

        {!room && (
          <TabsPanel value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Live transcript</CardTitle>
                <CardDescription>
                  What people say in the call shows up here while it's going, and is cleared when it
                  ends.
                </CardDescription>
              </CardHeader>
              <CardPanel>
                <TranscriptFeed meetingId={meeting._id} code={meeting.code} />
              </CardPanel>
            </Card>
          </TabsPanel>
        )}

        {meeting.sessions.length > 0 && (
          <TabsPanel value="recaps">
            <Recaps meeting={meeting} room={room} zone={zone} />
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
};
