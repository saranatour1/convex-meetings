import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  RtkAvatar,
  RtkCameraSelector,
  RtkMicrophoneSelector,
  RtkParticipantTile,
  RtkSpeakerSelector,
} from "@cloudflare/realtimekit-react-ui";
import { Button } from "@meetings/ui/components/button";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";
import { MediaControls } from "./media-controls.tsx";

export const CallLobby = ({ title, kind }: { title: string; kind: MeetingKind }) => {
  const { meeting } = useRealtimeKitMeeting();
  const name = useRealtimeKitSelector((m) => m.self.name);
  const waiting = useRealtimeKitSelector((m) => m.self.roomState === "waitlisted");

  return (
    <div className="grid items-center gap-6 rounded-xl border p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:p-6">
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted">
        {kind === "audioRoom" ? (
          <RtkAvatar participant={meeting.self} size="lg" />
        ) : (
          <RtkParticipantTile
            meeting={meeting}
            participant={meeting.self}
            className="size-full rounded-none"
          />
        )}
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <MediaControls kind={kind} />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Ready to join?</span>
          <h2 className="font-semibold text-xl">{title}</h2>
          <span className="text-muted-foreground text-sm">
            {kindOf(kind).label} · you'll join as {name}
          </span>
        </div>
        <div className="flex flex-col gap-3 [&_rtk-microphone-selector]:w-full [&_rtk-camera-selector]:w-full [&_rtk-speaker-selector]:w-full">
          <RtkMicrophoneSelector meeting={meeting} />
          {kind !== "audioRoom" && <RtkCameraSelector meeting={meeting} />}
          <RtkSpeakerSelector meeting={meeting} />
        </div>
        <Button size="lg" disabled={waiting} onClick={() => void meeting.join()}>
          {waiting ? "Waiting for the host to let you in…" : "Join now"}
        </Button>
      </div>
    </div>
  );
};
