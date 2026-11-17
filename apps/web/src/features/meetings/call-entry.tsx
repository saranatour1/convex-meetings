import { lazy } from "react";
import { VideoIcon, VideoOffIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { kindOf, type MeetingKind } from "./meeting-kinds.ts";

const loadMeetingCall = () => import("./meeting-call.tsx");

export const MeetingCall = lazy(() =>
  loadMeetingCall().then((module) => ({ default: module.MeetingCall })),
);

type JoinCallCardProps = { kind: MeetingKind; onJoin: () => void; hint?: string };

export const JoinCallCard = ({ kind, onJoin, hint }: JoinCallCardProps) => (
  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4">
    <span className="grid size-10 place-items-center rounded-full bg-muted">
      <VideoIcon className="size-5" />
    </span>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="font-medium text-sm">{kindOf(kind).label}</span>
      <span className="text-muted-foreground text-sm">
        {hint ?? "Check your camera and mic before you go in."}
      </span>
    </div>
    <Button
      onPointerEnter={() => void loadMeetingCall()}
      onFocus={() => void loadMeetingCall()}
      onClick={onJoin}
    >
      <VideoIcon />
      Join the call
    </Button>
  </div>
);

export const MeetingEnded = ({ endedAt, room }: { endedAt: number; room?: boolean }) => (
  <div className="flex items-center gap-4 rounded-xl border border-dashed p-4">
    <span className="grid size-10 place-items-center rounded-full bg-muted">
      <VideoOffIcon className="size-5" />
    </span>
    <span className="text-muted-foreground text-sm">
      {room ? "This room was closed" : "This meeting ended"} on{" "}
      {formatDate(endedAt, browserTimeZone())} at {formatTime(endedAt, browserTimeZone())}
      {room ? "." : ", after everyone left. Schedule a new one to meet again."}
    </span>
  </div>
);
