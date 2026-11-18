import { track } from "@databuddy/sdk";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { useMutation } from "convex/react";
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
  CheckIcon,
  CircleIcon,
  EllipsisIcon,
  HandIcon,
  MaximizeIcon,
  MessageSquareIcon,
  PhoneOffIcon,
  PictureInPicture2Icon,
  PuzzleIcon,
  ScrollTextIcon,
  SettingsIcon,
  SquareIcon,
  SplitIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@meetings/ui/components/menu";
import { toastManager } from "@meetings/ui/components/toast";
import { cn } from "@meetings/ui/lib/utils";
import { describeError } from "#/lib/errors.ts";
import { formatElapsed } from "#/lib/schedule.ts";
import { useSecond } from "../clock.ts";
import { useGuestPass } from "../guest-pass.ts";
import { MeetingChat } from "../meeting-chat.tsx";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";
import { RTK_SECTIONS, emitCallUi, type CallSide } from "./call-ui.ts";
import { FrameSampler } from "./frame-sampler.tsx";
import { LiveTranscript } from "./live-transcript.tsx";
import { MediaControls } from "./media-controls.tsx";
import { JoinRequests } from "../join-requests.tsx";
import { OtherDevices, listenToOwnDevices } from "./other-devices.tsx";
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

type SidePanelProps = { title: string; onClose: () => void; children: ReactNode };

const SidePanel = ({ title, onClose, children }: SidePanelProps) => (
  <aside aria-label={title} className="flex w-80 shrink-0 flex-col border-s">
    <div className="flex items-center justify-between border-b px-3 py-2">
      <span className="font-medium text-sm">{title}</span>
      <Button size="icon-sm" variant="ghost" aria-label={`Close ${title}`} onClick={onClose}>
        <XIcon />
      </Button>
    </div>
    {children}
  </aside>
);

const Elapsed = () => {
  const startedAt = useRealtimeKitSelector((m) => m.meta.meetingStartedTimestamp);
  const now = useSecond();
  return startedAt ? (
    <span className="font-mono text-muted-foreground text-xs tabular-nums">
      <span className="sr-only">In the call for </span>
      {formatElapsed(now - new Date(startedAt).getTime())}
    </span>
  ) : null;
};

type CallRoomProps = {
  meetingId: Id<"meetings">;
  title: string;
  kind: MeetingKind;
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  canControl: boolean;
  isProtected: boolean;
  moderated: boolean;
};

export const CallRoom = ({
  meetingId,
  title,
  kind,
  side,
  onSideChange,
  expanded,
  onExpandedChange,
  canControl,
  isProtected,
  moderated,
}: CallRoomProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const end = useMutation(api.calls.end);
  const leftOnDevice = useMutation(api.calls.leftOnDevice);
  const pass = useGuestPass();
  const startedAt = useRealtimeKitSelector((m) => m.meta.meetingStartedTimestamp);
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

  const panels: {
    side: CallSide;
    label: string;
    icon: typeof UsersIcon;
    show: boolean;
    inDock?: boolean;
  }[] = [
    { side: "chat", label: "Chat", icon: MessageSquareIcon, show: true, inDock: true },
    { side: "participants", label: "People", icon: UsersIcon, show: true, inDock: true },
    {
      side: "polls",
      label: "Polls",
      icon: ChartBarIcon,
      show: kind === "webinar" || kind === "classroom",
    },
    { side: "plugins", label: "Whiteboard and plugins", icon: PuzzleIcon, show: !moderated },
    { side: "ai", label: "Transcript", icon: ScrollTextIcon, show: true },
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
        const stopListening = listenToOwnDevices(meeting);
        const peerId = meeting.self.id;
        const reportLeft = () =>
          void leftOnDevice({ meetingId, peerId, ...pass }).catch(() => null);
        meeting.self.on("roomLeft", reportLeft);
        return () => {
          element.removeEventListener("rtkStateUpdate", sync);
          stopListening();
          meeting.self.off("roomLeft", reportLeft);
        };
      }}
    >
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span className="truncate font-medium text-sm">{title}</span>
        <Badge variant="outline">
          <span aria-hidden className={cn("size-1.5 rounded-full", kindOf(kind).dot)} />
          {kindOf(kind).label}
        </Badge>
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
      </header>

      <OtherDevices />
      {moderated && <FrameSampler meetingId={meetingId} />}
      {canControl && <JoinRequests meetingId={meetingId} className="border-b px-4 py-2" />}
      <div className="flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1 bg-muted/40 p-2 pb-24"
          onContextMenu={isProtected ? (event) => event.preventDefault() : undefined}
          onDragStart={isProtected ? (event) => event.preventDefault() : undefined}
        >
          {sharing ? (
            <ShareStage
              meetingId={meetingId}
              sharerId={remoteSharer}
              expanded={expanded}
              onExpandedChange={onExpandedChange}
              annotate={!moderated}
              canSnapshot={!isProtected || canControl}
              canClearAll={canControl}
            />
          ) : (
            <RtkGrid meeting={meeting} className="size-full" />
          )}
          <div
            role="toolbar"
            aria-label="Call controls"
            className="absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-2 rounded-3xl border bg-popover/95 p-2 shadow-lg backdrop-blur"
          >
            <StageButton />
            <MediaControls kind={kind} screenShare />
            <span aria-hidden className="h-6 w-px bg-border" />
            {panels
              .filter((panel) => panel.inDock)
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
            <Menu>
              <MenuTrigger render={<Tool label="More" />}>
                <EllipsisIcon />
              </MenuTrigger>
              <MenuPopup align="end" side="top">
                {canPip && (
                  <MenuItem
                    onClick={() =>
                      pipActive
                        ? meeting.participants.pip.disable()
                        : meeting.participants.pip.enable()
                    }
                  >
                    <PictureInPicture2Icon />
                    {pipActive ? "Close picture-in-picture" : "Picture-in-picture"}
                  </MenuItem>
                )}
                {canRecord && !isProtected && (
                  <MenuItem
                    variant={isRecording ? "destructive" : "default"}
                    onClick={() =>
                      void (isRecording ? meeting.recording.stop() : meeting.recording.start())
                    }
                  >
                    {isRecording ? <SquareIcon /> : <CircleIcon />}
                    {isRecording ? "Stop recording" : "Record"}
                  </MenuItem>
                )}
                {panels
                  .filter((panel) => !panel.inDock && panel.show)
                  .map((panel) => (
                    <MenuItem
                      key={panel.side}
                      onClick={() => openSide(side === panel.side ? undefined : panel.side)}
                    >
                      <panel.icon />
                      {panel.label}
                      {side === panel.side && <CheckIcon className="ms-auto" />}
                    </MenuItem>
                  ))}
                {canBreakout && (
                  <MenuItem
                    onClick={() =>
                      emitCallUi(root.current, { activeBreakoutRoomsManager: { active: true } })
                    }
                  >
                    <SplitIcon />
                    Breakout rooms
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem onClick={() => emitCallUi(root.current, { activeSettings: true })}>
                  <SettingsIcon />
                  Settings
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    void (document.fullscreenElement
                      ? document.exitFullscreen()
                      : document.documentElement.requestFullscreen())
                  }
                >
                  <MaximizeIcon />
                  Full screen
                </MenuItem>
              </MenuPopup>
            </Menu>
            <span aria-hidden className="h-6 w-px bg-border" />
            {canControl ? (
              <Menu>
                <MenuTrigger render={<Button variant="destructive" className="rounded-full" />}>
                  <PhoneOffIcon />
                  Leave
                </MenuTrigger>
                <MenuPopup align="end" side="top">
                  <MenuItem
                    onClick={() => emitCallUi(root.current, { activeLeaveConfirmation: true })}
                  >
                    <PhoneOffIcon />
                    Leave the call
                  </MenuItem>
                  <MenuItem
                    variant="destructive"
                    onClick={() =>
                      void end({ meetingId })
                        .then(() => track("call_ended"))
                        .catch((error: unknown) =>
                          toastManager.add({ title: describeError(error), type: "error" }),
                        )
                    }
                  >
                    <UsersIcon />
                    End for everyone
                  </MenuItem>
                </MenuPopup>
              </Menu>
            ) : (
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={() => emitCallUi(root.current, { activeLeaveConfirmation: true })}
              >
                <PhoneOffIcon />
                Leave
              </Button>
            )}
          </div>
        </div>
        <RtkSidebar
          meeting={meeting}
          className={cn("shrink-0 border-s", !(side && RTK_SECTIONS.includes(side)) && "hidden")}
        />
        {side === "chat" && (
          <SidePanel title="Chat" onClose={() => openSide(undefined)}>
            <MeetingChat
              className="min-h-0 flex-1 p-3"
              meetingId={meetingId}
              since={startedAt ? new Date(startedAt).getTime() : undefined}
            />
          </SidePanel>
        )}
        {side === "ai" && (
          <SidePanel title="Transcript" onClose={() => openSide(undefined)}>
            <LiveTranscript />
          </SidePanel>
        )}
      </div>

      <RtkParticipantsAudio meeting={meeting} />
      <RtkDialogManager meeting={meeting} />
      <RtkNotifications meeting={meeting} />
    </div>
  );
};
