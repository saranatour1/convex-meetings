import type { ReactNode } from "react";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  RtkAiToggle,
  RtkBreakoutRoomsToggle,
  RtkClock,
  RtkDialogManager,
  RtkFullscreenToggle,
  RtkGrid,
  RtkLeaveButton,
  RtkNotifications,
  RtkParticipantsAudio,
  RtkParticipantsToggle,
  RtkPipToggle,
  RtkPluginsToggle,
  RtkPollsToggle,
  RtkRecordingIndicator,
  RtkRecordingToggle,
  RtkSettingsToggle,
  RtkSidebar,
  RtkStageToggle,
} from "@cloudflare/realtimekit-react-ui";
import { MessageSquareIcon, UsersIcon, XIcon } from "lucide-react";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";
import { MediaControls } from "./media-controls.tsx";

type CallRoomProps = {
  title: string;
  kind: MeetingKind;
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  chat: ReactNode;
};

export const CallRoom = ({ title, kind, chatOpen, onChatOpenChange, chat }: CallRoomProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const people = useRealtimeKitSelector((m) => m.participants.joined.size + 1);
  const staged = kind !== "groupCall";
  const hasPolls = kind === "webinar" || kind === "classroom";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <span className="truncate font-medium text-sm">{title}</span>
        <Badge variant="outline">{kindOf(kind).label}</Badge>
        <RtkClock meeting={meeting} size="sm" />
        <RtkRecordingIndicator meeting={meeting} />
        <span className="ms-auto flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
          <UsersIcon className="size-3.5" />
          {people} in the call
        </span>
        <RtkFullscreenToggle size="sm" />
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-muted/40 p-2">
          <RtkGrid meeting={meeting} className="size-full" />
        </div>
        <RtkSidebar meeting={meeting} className="max-w-80 shrink-0 border-s empty:hidden" />
        {chatOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-s">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="font-medium text-sm">Chat</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close chat"
                onClick={() => onChatOpenChange(false)}
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
          <RtkSettingsToggle size="sm" />
          {staged && <RtkStageToggle meeting={meeting} size="sm" />}
          {kind === "classroom" && <RtkBreakoutRoomsToggle meeting={meeting} size="sm" />}
        </div>
        <div className="flex items-center gap-2">
          <MediaControls kind={kind} screenShare />
          {kind !== "audioRoom" && <RtkPipToggle meeting={meeting} size="sm" />}
          <RtkRecordingToggle meeting={meeting} size="sm" />
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant={chatOpen ? "secondary" : "ghost"}
            aria-label="Chat"
            aria-pressed={chatOpen}
            title="Chat"
            onClick={() => onChatOpenChange(!chatOpen)}
          >
            <MessageSquareIcon />
          </Button>
          <RtkParticipantsToggle meeting={meeting} size="sm" />
          {hasPolls && <RtkPollsToggle meeting={meeting} size="sm" />}
          <RtkPluginsToggle meeting={meeting} size="sm" />
          <RtkAiToggle meeting={meeting} size="sm" />
          <RtkLeaveButton size="sm" />
        </div>
      </footer>

      <RtkParticipantsAudio meeting={meeting} />
      <RtkDialogManager meeting={meeting} />
      <RtkNotifications meeting={meeting} />
    </div>
  );
};
