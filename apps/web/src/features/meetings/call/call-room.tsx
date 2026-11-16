import { type ComponentProps, type ReactNode, useRef } from "react";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  RtkDialogManager,
  RtkGrid,
  RtkNotifications,
  RtkParticipantsAudio,
  RtkSidebar,
} from "@cloudflare/realtimekit-react-ui";
import {
  ChartBarIcon,
  CircleIcon,
  ClockIcon,
  HandIcon,
  MaximizeIcon,
  MessageSquareIcon,
  PhoneOffIcon,
  PictureInPicture2Icon,
  PuzzleIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  SplitIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";
import { RTK_SECTIONS, emitCallUi, type CallSide } from "./call-ui.ts";
import { MediaControls } from "./media-controls.tsx";
import { ShareStage } from "./share-stage.tsx";

type ToolProps = ComponentProps<typeof Button> & { label: string; active?: boolean };

const Tool = ({ label, active, className, ...props }: ToolProps) => (
  <Button
    size="icon-lg"
    variant={active ? "secondary" : "ghost"}
    className={cn("rounded-full", className)}
    aria-label={label}
    aria-pressed={active}
    title={label}
    {...props}
  />
);

const StageButton = () => {
  const { meeting } = useRealtimeKitMeeting();
  const status = useRealtimeKitSelector((m) => m.stage.status);
  const needsStage = useRealtimeKitSelector(
    (m) => m.self.permissions.canProduceAudio === "CAN_REQUEST",
  );
  if (!needsStage) return null;
  const action = {
    OFF_STAGE: { label: "Ask to speak", run: () => meeting.stage.requestAccess() },
    REQUESTED_TO_JOIN_STAGE: {
      label: "Cancel request",
      run: () => meeting.stage.cancelRequestAccess(),
    },
    ACCEPTED_TO_JOIN_STAGE: { label: "Join the stage", run: () => meeting.stage.join() },
    ON_STAGE: { label: "Leave the stage", run: () => meeting.stage.leave() },
  }[status];
  return (
    <Button
      variant={status === "ACCEPTED_TO_JOIN_STAGE" ? "default" : "outline"}
      className="rounded-full"
      onClick={() => void action.run()}
    >
      <HandIcon />
      {action.label}
    </Button>
  );
};

const Elapsed = () => {
  const startedAt = useRealtimeKitSelector((m) => m.meta.meetingStartedTimestamp);
  return startedAt ? (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
      <ClockIcon className="size-3.5" />
      since {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  ) : null;
};

type CallRoomProps = {
  title: string;
  kind: MeetingKind;
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  chat: ReactNode;
};

export const CallRoom = ({
  title,
  kind,
  side,
  onSideChange,
  expanded,
  onExpandedChange,
  chat,
}: CallRoomProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const root = useRef<HTMLDivElement | null>(null);
  const people = useRealtimeKitSelector((m) => m.participants.joined.size + 1);
  const recording = useRealtimeKitSelector((m) => m.recording.recordingState);
  const canRecord = useRealtimeKitSelector((m) => m.self.permissions.canRecord);
  const pipActive = useRealtimeKitSelector((m) => m.participants.pip?.isActive ?? false);
  const canPip = kind !== "audioRoom" && meeting.participants.pip?.isSupported();
  const canBreakout = useRealtimeKitSelector(
    (m) => kind === "classroom" && m.self.permissions.connectedMeetings?.canAlterConnectedMeetings,
  );
  const remoteSharer = useRealtimeKitSelector(
    (m) => m.participants.joined.toArray().find((p) => p.screenShareEnabled)?.id ?? null,
  );
  const selfSharing = useRealtimeKitSelector((m) => m.self.screenShareEnabled);
  const pluginActive = useRealtimeKitSelector((m) => m.plugins.active.size > 0);
  const sharing = !pluginActive && (remoteSharer !== null || selfSharing);
  const isRecording = recording === "RECORDING" || recording === "STARTING";

  const openSide = (next: CallSide | undefined) => {
    const rtk = next && RTK_SECTIONS.includes(next) ? next : undefined;
    emitCallUi(root.current, { activeSidebar: Boolean(rtk), sidebar: rtk });
    onSideChange(next);
  };

  const panels: { side: CallSide; label: string; icon: typeof UsersIcon; show: boolean }[] = [
    { side: "chat", label: "Chat", icon: MessageSquareIcon, show: true },
    { side: "participants", label: "People", icon: UsersIcon, show: true },
    {
      side: "polls",
      label: "Polls",
      icon: ChartBarIcon,
      show: kind === "webinar" || kind === "classroom",
    },
    { side: "plugins", label: "Plugins and whiteboard", icon: PuzzleIcon, show: true },
    { side: "ai", label: "AI transcript", icon: SparklesIcon, show: true },
  ];

  return (
    <div
      className="flex h-dvh flex-col"
      ref={(element) => {
        root.current = element;
        if (!element) return;
        const rtkSide = side && RTK_SECTIONS.includes(side) ? side : undefined;
        emitCallUi(element, { activeSidebar: Boolean(rtkSide), sidebar: rtkSide });
        const sync = (event: Event) => {
          const detail = (event as CustomEvent<{ activeSidebar?: boolean; sidebar?: CallSide }>)
            .detail;
          if (detail?.activeSidebar === false && side && RTK_SECTIONS.includes(side)) {
            onSideChange(undefined);
          }
        };
        element.addEventListener("rtkStateUpdate", sync);
        return () => element.removeEventListener("rtkStateUpdate", sync);
      }}
    >
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span className="truncate font-medium text-sm">{title}</span>
        <Badge variant="outline">{kindOf(kind).label}</Badge>
        <Elapsed />
        {isRecording && (
          <Badge variant="error">
            <CircleIcon className="fill-current" />
            Recording
          </Badge>
        )}
        <span className="ms-auto flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
          <UsersIcon className="size-3.5" />
          {people} in the call
        </span>
        <Tool
          label="Full screen"
          size="icon"
          onClick={() =>
            void (document.fullscreenElement
              ? document.exitFullscreen()
              : document.documentElement.requestFullscreen())
          }
        >
          <MaximizeIcon />
        </Tool>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-muted/40 p-2">
          {sharing ? (
            <ShareStage
              sharerId={remoteSharer}
              expanded={expanded}
              onExpandedChange={onExpandedChange}
            />
          ) : (
            <RtkGrid meeting={meeting} className="size-full" />
          )}
        </div>
        <RtkSidebar meeting={meeting} className="shrink-0" />
        {side === "chat" && (
          <aside className="flex w-80 shrink-0 flex-col border-s">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="font-medium text-sm">Chat</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close chat"
                onClick={() => openSide(undefined)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{chat}</div>
          </aside>
        )}
      </div>

      <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t px-4 py-2">
        <div className="flex items-center gap-1">
          <Tool label="Settings" onClick={() => emitCallUi(root.current, { activeSettings: true })}>
            <SettingsIcon />
          </Tool>
          {canBreakout && (
            <Tool
              label="Breakout rooms"
              onClick={() =>
                emitCallUi(root.current, { activeBreakoutRoomsManager: { active: true } })
              }
            >
              <SplitIcon />
            </Tool>
          )}
          <StageButton />
        </div>
        <div className="flex items-center gap-2">
          <MediaControls kind={kind} screenShare />
          {canPip && (
            <Tool
              label={pipActive ? "Close picture-in-picture" : "Picture-in-picture"}
              active={pipActive}
              onClick={() =>
                pipActive ? meeting.participants.pip.disable() : meeting.participants.pip.enable()
              }
            >
              <PictureInPicture2Icon />
            </Tool>
          )}
          {canRecord && (
            <Tool
              label={isRecording ? "Stop recording" : "Record"}
              active={isRecording}
              className={cn(isRecording && "text-destructive-foreground")}
              onClick={() =>
                void (isRecording ? meeting.recording.stop() : meeting.recording.start())
              }
            >
              {isRecording ? <SquareIcon /> : <CircleIcon />}
            </Tool>
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          {panels
            .filter((panel) => panel.show)
            .map((panel) => (
              <Tool
                key={panel.side}
                label={panel.label}
                active={side === panel.side}
                onClick={() => openSide(side === panel.side ? undefined : panel.side)}
              >
                <panel.icon />
              </Tool>
            ))}
          <Button
            variant="destructive"
            className="ms-2 rounded-full"
            onClick={() => emitCallUi(root.current, { activeLeaveConfirmation: true })}
          >
            <PhoneOffIcon />
            Leave
          </Button>
        </div>
      </footer>

      <RtkParticipantsAudio meeting={meeting} />
      <RtkDialogManager meeting={meeting} />
      <RtkNotifications meeting={meeting} />
    </div>
  );
};
