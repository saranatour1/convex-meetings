import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  UserCheckIcon,
  UserXIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { copyWithToast, showError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { cityOf, formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";
import type { CallSide } from "./call/call-ui.ts";
import { JoinCallCard, MeetingCall, MeetingEnded } from "./call-entry.tsx";
import {
  InviteToMeeting,
  MeetingDoor,
  MeetingSettingsCard,
  meetingLink,
} from "./meeting-access.tsx";
import { JoinRequests } from "./join-requests.tsx";
import { MeetingChat } from "./meeting-chat.tsx";
import { kindOf } from "./meeting-kinds.ts";

const RESPONSE_LABEL = { accepted: "Going", declined: "Not going", pending: "No reply yet" };

type MeetingPageProps = {
  code: string;
  onCancelled: () => void;
  inCall: boolean;
  onInCallChange: (inCall: boolean) => void;
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
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
}: MeetingPageProps) => {
  const meeting = useQuery(api.meetings.get, { code });
  const respond = useMutation(api.meetings.respond);
  const cancel = useMutation(api.meetings.cancel);
  const remove = useMutation(api.calls.remove);
  const letIn = useMutation(api.calls.letIn);
  if (meeting === undefined) return <LoadingScreen />;
  if (meeting === null) return <MeetingDoor code={code} />;
  const meetingId = meeting._id;

  const zone = browserTimeZone();
  const time = meeting.time;
  const isHost = meeting.me.role === "host";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {meeting.title}
            <Badge variant="outline">{kindOf(meeting.kind).label}</Badge>
          </CardTitle>
          {time && (
            <CardDescription className="tabular-nums">
              {formatDate(time.startsAt, zone)} · {formatTime(time.startsAt, zone)}–
              {formatTime(time.endsAt, zone)}
              {time.timeZone !== zone &&
                ` · ${formatTime(time.startsAt, time.timeZone)} in ${cityOf(time.timeZone)}`}
              {time.rrule && " · repeats"}
            </CardDescription>
          )}
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-muted-foreground text-sm">
              {meetingLink(meeting.code)}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Copy meeting link"
              onClick={() => void copyWithToast(meetingLink(meeting.code), "Meeting link copied")}
            >
              <CopyIcon />
            </Button>
          </div>
        </CardHeader>
        <CardPanel className="flex flex-col gap-6">
          {meeting.me.canControl && !inCall && (
            <JoinRequests meetingId={meetingId} className="rounded-lg p-3" />
          )}
          {meeting.endedAt ? (
            <MeetingEnded endedAt={meeting.endedAt} />
          ) : inCall ? (
            <Suspense fallback={<Button disabled>Loading call…</Button>}>
              <MeetingCall
                meetingId={meetingId}
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
              />
            </Suspense>
          ) : (
            <JoinCallCard kind={meeting.kind} onJoin={() => onInCallChange(true)} />
          )}
          <div className="flex flex-wrap gap-2">
            {isHost ? (
              <Button
                variant="ghost"
                onClick={() =>
                  void cancel({ meetingId })
                    .then(() => {
                      track("meeting_cancelled");
                      onCancelled();
                    })
                    .catch(showError)
                }
              >
                <XIcon />
                Cancel meeting
              </Button>
            ) : (
              <>
                <Button
                  variant={meeting.me.response === "accepted" ? "default" : "outline"}
                  onClick={() =>
                    void respond({ meetingId, response: "accepted" })
                      .then(() => track("meeting_responded", { response: "accepted" }))
                      .catch(showError)
                  }
                >
                  <CheckIcon />
                  Going
                </Button>
                <Button
                  variant={meeting.me.response === "declined" ? "default" : "outline"}
                  onClick={() =>
                    void respond({ meetingId, response: "declined" })
                      .then(() => track("meeting_responded", { response: "declined" }))
                      .catch(showError)
                  }
                >
                  Not going
                </Button>
              </>
            )}
          </div>
          {meeting.me.canInvite && <InviteToMeeting meetingId={meetingId} />}
          <ul className="flex flex-col gap-2">
            {meeting.people.map((person) => (
              <li key={person._id} className="flex items-center gap-3">
                <Avatar className="size-7">
                  {person.imageUrl && <AvatarImage src={person.imageUrl} alt="" />}
                  <AvatarFallback className="text-xs">{getInitials(person.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{person.name}</span>
                <span className="text-muted-foreground text-xs">
                  {person.role === "host" ? "Host" : RESPONSE_LABEL[person.response]}
                </span>
                {person.isGuest && (
                  <Badge variant="outline" size="sm">
                    Guest
                  </Badge>
                )}
                {person.removed && (
                  <Badge variant="error" size="sm">
                    Removed
                  </Badge>
                )}
                {meeting.me.canControl && person._id !== meeting.me._id && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="ms-auto"
                    onClick={() =>
                      void (
                        person.removed
                          ? letIn({ meetingMemberId: person._id })
                          : remove({ meetingMemberId: person._id })
                      ).catch(showError)
                    }
                  >
                    {person.removed ? (
                      <>
                        <UserCheckIcon />
                        Let back in
                      </>
                    ) : (
                      <>
                        <UserXIcon />
                        Remove from call
                      </>
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardPanel>
      </Card>

      {meeting.me.canControl && (
        <MeetingSettingsCard
          meetingId={meetingId}
          access={meeting.access}
          inviters={meeting.inviters}
          isProtected={meeting.protected}
        />
      )}

      {meeting.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="size-4" />
              Recaps
            </CardTitle>
            <CardDescription>
              {meeting.recap
                ? "Summaries arrive a few minutes after a call ends. Links last 7 days."
                : "Transcripts and summaries are off for this meeting."}
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-4">
            {meeting.sessions.map((session) => (
              <section key={session._id} className="flex flex-col gap-1">
                <Link
                  to="/meetings/$code/recaps/$number"
                  params={{ code: meeting.code, number: session.number }}
                  className="font-medium text-sm tabular-nums underline-offset-4 hover:underline"
                >
                  {formatDate(session.startedAt, zone)} · {formatTime(session.startedAt, zone)}
                  {session.endedAt &&
                    `–${formatTime(session.endedAt, zone)} · ${formatDuration(session.endedAt - session.startedAt) || "under a minute"}`}{" "}
                  · {session.attendees} joined →
                </Link>
                {session.summary && (
                  <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                    {session.summary}
                  </p>
                )}
                <div className="flex gap-3 text-muted-foreground text-xs">
                  {session.hasTranscript && <span>Transcript</span>}
                  {session.hasRecording && (
                    <span className="flex items-center gap-1">
                      <VideoIcon className="size-3.5" />
                      Recording
                    </span>
                  )}
                </div>
              </section>
            ))}
          </CardPanel>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>Only people invited to this meeting see it.</CardDescription>
        </CardHeader>
        <CardPanel>
          <MeetingChat className="h-96" meetingId={meetingId} />
        </CardPanel>
      </Card>
    </div>
  );
};
