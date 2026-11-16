import type { ReactNode } from "react";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  RtkBreakoutRoomsToggle,
  RtkDialogManager,
  RtkGrid,
  RtkNotifications,
  RtkParticipants,
  RtkParticipantsAudio,
  RtkPolls,
  RtkRecordingIndicator,
  RtkSettingsToggle,
  RtkStageToggle,
} from "@cloudflare/realtimekit-react-ui";
import { ChartBarIcon, MessageSquareIcon, PhoneOffIcon, UsersIcon, XIcon } from "lucide-react";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";
import { MediaControls } from "./media-controls.tsx";

export type CallPanel = "people" | "chat" | "polls";

const PANELS: { value: CallPanel; label: string; icon: typeof UsersIcon }[] = [
  { value: "people", label: "People", icon: UsersIcon },
  { value: "chat", label: "Chat", icon: MessageSquareIcon },
  { value: "polls", label: "Polls", icon: ChartBarIcon },
];

type CallRoomProps = {
  title: string;
  kind: MeetingKind;
  panel?: CallPanel;
  onPanelChange: (panel: CallPanel | undefined) => void;
  chat: ReactNode;
};

export const CallRoom = ({ title, kind, panel, onPanelChange, chat }: CallRoomProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const people = useRealtimeKitSelector((m) => m.participants.joined.size + 1);
  const staged = kind !== "groupCall";
  const panels = PANELS.filter(
    (p) => p.value !== "polls" || kind === "webinar" || kind === "classroom",
  );
  const open = panels.find((p) => p.value === panel);

  return (
    <div className="flex h-[78dvh] min-h-[28rem] flex-col overflow-hidden rounded-xl border bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <span className="truncate font-medium text-sm">{title}</span>
        <Badge variant="outline">{kindOf(kind).label}</Badge>
        <RtkRecordingIndicator meeting={meeting} />
        <span className="ms-auto flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
          <UsersIcon className="size-3.5" />
          {people} in the call
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-muted/40 p-2">
          <RtkGrid meeting={meeting} className="size-full" />
        </div>
        {open && (
          <aside className="flex w-80 shrink-0 flex-col border-s">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="font-medium text-sm">{open.label}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Close ${open.label}`}
                onClick={() => onPanelChange(undefined)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {open.value === "chat" ? (
                chat
              ) : open.value === "people" ? (
                <RtkParticipants meeting={meeting} className="h-full" />
              ) : (
                <RtkPolls meeting={meeting} className="h-full" />
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t px-4 py-3">
        <div className="flex items-center gap-1">
          {staged && <RtkStageToggle meeting={meeting} size="sm" />}
          {kind === "classroom" && <RtkBreakoutRoomsToggle meeting={meeting} size="sm" />}
          <RtkSettingsToggle size="sm" />
        </div>
        <MediaControls kind={kind} screenShare />
        <div className="flex items-center justify-end gap-1">
          {panels.map((p) => (
            <Button
              key={p.value}
              size="icon"
              variant={panel === p.value ? "secondary" : "ghost"}
              aria-label={p.label}
              aria-pressed={panel === p.value}
              title={p.label}
              onClick={() => onPanelChange(panel === p.value ? undefined : p.value)}
            >
              <p.icon />
            </Button>
          ))}
          <Button
            variant="destructive"
            className="ms-2 rounded-full"
            onClick={() => void meeting.leave()}
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
