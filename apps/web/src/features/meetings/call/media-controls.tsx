import type { ComponentProps } from "react";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  MonitorXIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import type { MeetingKind } from "../meeting-kinds.ts";

type ControlButtonProps = ComponentProps<typeof Button> & { label: string; on: boolean };

export const ControlButton = ({ label, on, className, ...props }: ControlButtonProps) => (
  <Button
    size="icon-lg"
    variant={on ? "secondary" : "destructive-outline"}
    className={cn("rounded-full", className)}
    aria-label={label}
    aria-pressed={on}
    title={label}
    {...props}
  />
);

const canProduce = (permission: string, onStage: boolean) =>
  permission === "ALLOWED" || (permission === "CAN_REQUEST" && onStage);

export const MediaControls = ({
  kind,
  screenShare,
}: {
  kind: MeetingKind;
  screenShare?: boolean;
}) => {
  const { meeting } = useRealtimeKitMeeting();
  const audioOn = useRealtimeKitSelector((m) => m.self.audioEnabled);
  const videoOn = useRealtimeKitSelector((m) => m.self.videoEnabled);
  const sharing = useRealtimeKitSelector((m) => m.self.screenShareEnabled);
  const onStage = useRealtimeKitSelector((m) => m.stage.status === "ON_STAGE");
  const canAudio = canProduce(
    useRealtimeKitSelector((m) => m.self.permissions.canProduceAudio),
    onStage,
  );
  const canVideo = canProduce(
    useRealtimeKitSelector((m) => m.self.permissions.canProduceVideo),
    onStage,
  );
  const canShare = canProduce(
    useRealtimeKitSelector((m) => m.self.permissions.canProduceScreenshare),
    onStage,
  );

  return (
    <div className="flex items-center gap-2">
      <ControlButton
        label={audioOn ? "Mute" : canAudio ? "Unmute" : "Ask to speak to unmute"}
        on={audioOn}
        disabled={!canAudio}
        onClick={() => void (audioOn ? meeting.self.disableAudio() : meeting.self.enableAudio())}
      >
        {audioOn ? <MicIcon /> : <MicOffIcon />}
      </ControlButton>
      {kind !== "audioRoom" && (
        <ControlButton
          label={videoOn ? "Turn camera off" : "Turn camera on"}
          on={videoOn}
          disabled={!canVideo}
          onClick={() => void (videoOn ? meeting.self.disableVideo() : meeting.self.enableVideo())}
        >
          {videoOn ? <VideoIcon /> : <VideoOffIcon />}
        </ControlButton>
      )}
      {screenShare && kind !== "audioRoom" && canShare && (
        <ControlButton
          label={sharing ? "Stop sharing" : "Share screen"}
          on
          variant={sharing ? "default" : "secondary"}
          onClick={() =>
            void (sharing ? meeting.self.disableScreenShare() : meeting.self.enableScreenShare())
          }
        >
          {sharing ? <MonitorXIcon /> : <MonitorUpIcon />}
        </ControlButton>
      )}
    </div>
  );
};
