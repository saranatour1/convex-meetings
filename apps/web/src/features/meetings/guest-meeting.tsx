import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { DoorOpenIcon, UserIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { toastManager } from "@meetings/ui/components/toast";
import { EmptyState } from "#/components/empty-state.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { JoinCallCard, MeetingCall, MeetingEnded } from "./call-entry.tsx";
import { othersInCall } from "./meeting-people.tsx";
import type { CallSearch } from "./call/call-search.ts";
import { GuestPassContext } from "./guest-pass.ts";
import { AgentCall } from "./agent-call.tsx";
import { MeetingChat } from "./meeting-chat.tsx";
import { TranscriptFeed } from "./transcript-feed.tsx";
import { kindOf } from "./meeting-kinds.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

type GuestMeetingProps = {
  secret: string;
  search: CallSearch & { code?: string };
  onSearchChange: (next: CallSearch) => void;
};

export const GuestMeeting = ({ secret, search, onSearchChange }: GuestMeetingProps) => {
  const pass = useConvexValue(api.guests.pass, { secret });
  const admitted = pass?.status === "in";
  const meeting = useConvexValue(
    api.meetings.get,
    pass && admitted ? { code: pass.code, guest: secret } : "skip",
  );
  const rename = useMutation(api.guests.rename);
  const entry = useConvexValue(
    api.guests.preview,
    pass === null && search.code ? { code: search.code } : "skip",
  );
  if (pass === undefined || (admitted && meeting === undefined)) return <LoadingScreen />;
  if (pass && pass.status !== "in") {
    return (
      <EmptyState
        icon={<DoorOpenIcon />}
        title={pass.title}
        description={
          pass.status === "waiting"
            ? `You asked to join as ${pass.name}. This page opens the meeting as soon as a host lets you in.`
            : pass.status === "denied"
              ? "A host didn't let you in."
              : "This meeting has ended."
        }
      />
    );
  }
  if (!pass || !meeting) {
    const open = entry && ["link", "ask", "public"].includes(entry.access);
    return (
      <EmptyState
        icon={<UserIcon />}
        title="This guest link doesn't work anymore"
        description={
          open
            ? "The meeting still lets guests in. Join again with your name."
            : "It expired, the host sent you a newer one, or the meeting was cancelled. Ask the host for a new invite."
        }
        action={
          open &&
          search.code && (
            <Button
              render={
                entry.access === "public" ? (
                  <Link to="/rooms/$code" params={{ code: search.code }} />
                ) : (
                  <Link to="/m/$code" params={{ code: search.code }} />
                )
              }
            >
              <DoorOpenIcon />
              Join again
            </Button>
          )
        }
      />
    );
  }
  const zone = browserTimeZone();
  const room = meeting.access === "public";
  const onInCallChange = (inCall: boolean) =>
    onSearchChange({
      call: inCall || undefined,
      watch: inCall ? search.watch : undefined,
      side: inCall ? search.side : undefined,
      expand: undefined,
      draw: undefined,
    });

  return (
    <GuestPassContext value={secret}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{meeting.title}</CardTitle>
            <CardDescription className="tabular-nums">
              {room ? "Public room" : kindOf(meeting.kind).label}
              {meeting.time &&
                !room &&
                ` · ${formatDate(meeting.time.startsAt, zone)} · ${formatTime(meeting.time.startsAt, zone)}–${formatTime(meeting.time.endsAt, zone)}`}{" "}
              · You're a guest
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="guest-display-name">Your name in the call</Label>
              <Input
                id="guest-display-name"
                key={pass.name}
                defaultValue={pass.name}
                maxLength={100}
                className="max-w-xs"
                onBlur={(event) => {
                  const name = event.target.value.trim();
                  if (name && name !== pass.name) {
                    void rename({ secret, name }).catch((error: unknown) =>
                      toastManager.add({ title: describeError(error), type: "error" }),
                    );
                  }
                }}
              />
            </div>
            {meeting.me.removed ? (
              <p className="text-muted-foreground text-sm">
                The host removed you from this meeting.
              </p>
            ) : meeting.endedAt ? (
              <MeetingEnded endedAt={meeting.endedAt} room={room} />
            ) : search.call === true && meeting.me.agent ? (
              <AgentCall
                meetingId={meeting._id}
                code={meeting.code}
                title={meeting.title}
                moderated={room}
                onLeave={() => onInCallChange(false)}
              />
            ) : search.call === true ? (
              <Suspense fallback={<Button disabled>Loading call…</Button>}>
                <MeetingCall
                  meetingId={meeting._id}
                  code={meeting.code}
                  title={meeting.title}
                  kind={meeting.kind}
                  inCall
                  onInCallChange={onInCallChange}
                  watch={search.watch === true}
                  side={search.side}
                  onSideChange={(side) => onSearchChange({ side })}
                  expanded={search.expand === true}
                  onExpandedChange={(expand) => onSearchChange({ expand: expand || undefined })}
                  canControl={false}
                  devicesInCall={meeting.me.devicesInCall}
                  isProtected={meeting.protected}
                  moderated={room}
                  peopleInCall={othersInCall(meeting)}
                  recap={meeting.recap}
                />
              </Suspense>
            ) : (
              <JoinCallCard
                kind={meeting.kind}
                onJoin={() => onInCallChange(true)}
                onWatch={
                  room ? undefined : () => onSearchChange({ call: true, watch: true, side: "ai" })
                }
                hint={room ? "You'll watch and listen. Chat stays open below." : undefined}
              />
            )}
            {room && (
              <p className="text-muted-foreground text-sm">
                As a guest you can watch, listen and chat.{" "}
                <Link
                  to="/sign-in"
                  search={{ redirect: `/rooms/${meeting.code}` }}
                  className="text-foreground underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                to turn on your camera and mic.
              </p>
            )}
          </CardPanel>
        </Card>
        {!room && (
          <Card>
            <CardHeader>
              <CardTitle>Live transcript</CardTitle>
            </CardHeader>
            <CardPanel>
              <TranscriptFeed meetingId={meeting._id} code={meeting.code} />
            </CardPanel>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardPanel>
            <MeetingChat className="h-96" meetingId={meeting._id} />
          </CardPanel>
        </Card>
      </div>
    </GuestPassContext>
  );
};
