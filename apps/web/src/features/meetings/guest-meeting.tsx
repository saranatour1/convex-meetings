import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
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
import type { CallSearch } from "./call/call-search.ts";
import { GuestPassContext } from "./guest-pass.ts";
import { MeetingChat } from "./meeting-chat.tsx";
import { kindOf } from "./meeting-kinds.ts";

type GuestMeetingProps = {
  secret: string;
  search: CallSearch;
  onSearchChange: (next: CallSearch) => void;
};

export const GuestMeeting = ({ secret, search, onSearchChange }: GuestMeetingProps) => {
  const pass = useQuery(api.guests.pass, { secret });
  const admitted = pass?.status === "in";
  const meeting = useQuery(
    api.meetings.get,
    pass && admitted ? { code: pass.code, guest: secret } : "skip",
  );
  const rename = useMutation(api.guests.rename);
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
    return (
      <EmptyState
        icon={<UserIcon />}
        title="This guest link doesn't work anymore"
        description="It expired or the meeting was cancelled. Ask the host for a new invite."
      />
    );
  }
  const zone = browserTimeZone();
  const room = meeting.access === "public";
  const onInCallChange = (inCall: boolean) =>
    onSearchChange({
      call: inCall || undefined,
      side: undefined,
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
            ) : search.call === true ? (
              <Suspense fallback={<Button disabled>Loading call…</Button>}>
                <MeetingCall
                  meetingId={meeting._id}
                  title={meeting.title}
                  kind={meeting.kind}
                  inCall
                  onInCallChange={onInCallChange}
                  side={search.side}
                  onSideChange={(side) => onSearchChange({ side })}
                  expanded={search.expand === true}
                  onExpandedChange={(expand) => onSearchChange({ expand: expand || undefined })}
                  canControl={false}
                  devicesInCall={meeting.me.devicesInCall}
                  isProtected={meeting.protected}
                  moderated={room}
                />
              </Suspense>
            ) : (
              <JoinCallCard
                kind={meeting.kind}
                onJoin={() => onInCallChange(true)}
                hint={room ? "You'll watch and listen. Chat stays open below." : undefined}
              />
            )}
            {room && (
              <p className="text-muted-foreground text-sm">
                As a guest you can watch, listen and chat.{" "}
                <Link
                  to="/sign-in"
                  search={{ redirect: `/meetings/${meeting.code}` }}
                  className="text-foreground underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                to turn on your camera and mic.
              </p>
            )}
          </CardPanel>
        </Card>
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
