import { Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckIcon,
  FileTextIcon,
  ShieldIcon,
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
import { Label } from "@meetings/ui/components/label";
import { Switch } from "@meetings/ui/components/switch";
import { toastManager } from "@meetings/ui/components/toast";
import { EmptyState } from "#/components/empty-state.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { cityOf, formatDate, formatTime } from "#/lib/schedule.ts";
import type { CallSide } from "./call/call-ui.ts";
import { MeetingChat } from "./meeting-chat.tsx";
import { kindOf } from "./meeting-kinds.ts";

const MeetingCall = lazy(() =>
  import("./meeting-call.tsx").then((module) => ({ default: module.MeetingCall })),
);

const showError = (error: unknown) =>
  toastManager.add({ title: describeError(error), type: "error" });

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
  const viewer = useQuery(api.users.viewer);
  const respond = useMutation(api.meetings.respond);
  const cancel = useMutation(api.meetings.cancel);
  const setProtected = useMutation(api.meetings.setProtected);
  const remove = useMutation(api.calls.remove);
  const letIn = useMutation(api.calls.letIn);
  if (meeting === undefined) return <LoadingScreen />;
  if (meeting === null) {
    return (
      <EmptyState
        icon={<VideoIcon />}
        title="No meeting with that code"
        description="Check the code or link, or ask whoever invited you to send it again."
      />
    );
  }
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
        </CardHeader>
        <CardPanel className="flex flex-col gap-6">
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
              watermark={
                meeting.protected && viewer
                  ? [viewer.name, viewer.email].filter(Boolean).join(" · ")
                  : null
              }
            />
          </Suspense>
          <div className="flex flex-wrap gap-2">
            {isHost ? (
              <Button variant="ghost" onClick={() => void cancel({ meetingId }).then(onCancelled)}>
                <XIcon />
                Cancel meeting
              </Button>
            ) : (
              <>
                <Button
                  variant={meeting.me.response === "accepted" ? "default" : "outline"}
                  onClick={() => void respond({ meetingId, response: "accepted" })}
                >
                  <CheckIcon />
                  Going
                </Button>
                <Button
                  variant={meeting.me.response === "declined" ? "default" : "outline"}
                  onClick={() => void respond({ meetingId, response: "declined" })}
                >
                  Not going
                </Button>
              </>
            )}
          </div>
          {meeting.me.canControl && (
            <Label className="justify-between gap-3 font-normal">
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldIcon className="size-4" />
                  Protected meeting
                </span>
                <span className="text-muted-foreground text-xs">
                  Marks every screen with the viewer's name and email, turns recording off and keeps
                  downloads to hosts. It can't stop screenshots.
                </span>
              </span>
              <Switch
                checked={meeting.protected}
                onCheckedChange={(on) =>
                  void setProtected({ meetingId, protected: on }).catch(showError)
                }
              />
            </Label>
          )}
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
                  to="/meetings/$code/recaps/$sessionId"
                  params={{ code: meeting.code, sessionId: session._id }}
                  className="font-medium text-sm tabular-nums underline-offset-4 hover:underline"
                >
                  {formatDate(session.startedAt, zone)} · {formatTime(session.startedAt, zone)}
                  {session.endedAt && `–${formatTime(session.endedAt, zone)}`} · {session.attendees}{" "}
                  joined →
                </Link>
                {session.summary && (
                  <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                    {session.summary}
                  </p>
                )}
                <div className="flex gap-3 text-sm">
                  {session.transcriptUrl && (
                    <a className="underline" href={session.transcriptUrl}>
                      Transcript
                    </a>
                  )}
                  {session.recordingUrl && (
                    <a className="flex items-center gap-1 underline" href={session.recordingUrl}>
                      <VideoIcon className="size-3.5" />
                      Recording
                    </a>
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
          <MeetingChat meetingId={meetingId} />
        </CardPanel>
      </Card>
    </div>
  );
};
