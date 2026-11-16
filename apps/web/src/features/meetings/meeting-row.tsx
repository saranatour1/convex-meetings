import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ChevronRightIcon, FileTextIcon, VideoIcon } from "lucide-react";
import type { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { kindOf } from "./meeting-kinds.ts";

export type MyMeeting = FunctionReturnType<typeof api.meetings.mine>["page"][number];

export const MeetingRow = ({ meeting, past }: { meeting: MyMeeting; past?: boolean }) => {
  const zone = browserTimeZone();
  const recap = past ? meeting.lastSession : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
      <Link
        to="/meetings/$code"
        params={{ code: meeting.code }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <VideoIcon className="size-4 opacity-70" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-sm">{meeting.title}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatDate(meeting.startsAt, zone)} · {formatTime(meeting.startsAt, zone)}–
            {formatTime(meeting.endsAt, zone)} · {kindOf(meeting.kind).label}
          </span>
        </span>
        {!past && meeting.response === "pending" && (
          <Badge variant="warning" size="sm">
            Needs reply
          </Badge>
        )}
        {!past && meeting.response === "declined" && (
          <Badge variant="outline" size="sm">
            Not going
          </Badge>
        )}
      </Link>
      {recap ? (
        <Link
          to="/meetings/$code/recaps/$sessionId"
          params={{ code: meeting.code, sessionId: recap._id }}
          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
        >
          <FileTextIcon className="size-3.5" />
          {recap.hasSummary ? "Recap" : "Details"}
          {recap.hasRecording && <VideoIcon className="size-3.5 opacity-70" />}
        </Link>
      ) : (
        <ChevronRightIcon className="size-4 opacity-50" />
      )}
    </li>
  );
};
