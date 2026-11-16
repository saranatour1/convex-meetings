import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { RtkParticipantTile, RtkScreenshareView } from "@cloudflare/realtimekit-react-ui";
import { Maximize2Icon, Minimize2Icon, MonitorUpIcon } from "lucide-react";
import type { Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { AnnotationLayer } from "./annotations.tsx";

const SelfShare = () => {
  const { meeting } = useRealtimeKitMeeting();
  const track = useRealtimeKitSelector((m) => m.self.screenShareTracks?.video);

  return (
    <div className="relative size-full">
      <video
        className="size-full object-contain"
        autoPlay
        muted
        playsInline
        ref={(video) => {
          const current = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
          if (video && track && current !== track) video.srcObject = new MediaStream([track]);
        }}
      />
      <div className="absolute start-3 bottom-3 flex items-center gap-2 rounded-full bg-background/90 py-1 ps-3 pe-1 text-xs shadow-sm">
        <MonitorUpIcon className="size-3.5" />
        You're sharing your screen
        <Button
          size="xs"
          variant="destructive"
          className="rounded-full"
          onClick={() => void meeting.self.disableScreenShare()}
        >
          Stop
        </Button>
      </div>
    </div>
  );
};

type ShareStageProps = {
  meetingId: Id<"meetings">;
  sharerId: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  canSnapshot: boolean;
  canClearAll: boolean;
};

export const ShareStage = ({
  meetingId,
  sharerId,
  expanded,
  onExpandedChange,
  canSnapshot,
  canClearAll,
}: ShareStageProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const others = useRealtimeKitSelector((m) => m.participants.joined.toArray());
  const selfTrack = useRealtimeKitSelector((m) => m.self.screenShareTracks?.video);
  const sharer = sharerId ? meeting.participants.joined.get(sharerId) : undefined;
  const shareId = sharer ? sharer.customParticipantId : meeting.self.customParticipantId;
  const track = sharer ? sharer.screenShareTracks?.video : selfTrack;

  return (
    <div className="flex size-full gap-2">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-neutral-950">
        {sharer ? (
          <RtkScreenshareView meeting={meeting} participant={sharer} className="size-full" />
        ) : (
          <SelfShare />
        )}
        {shareId && (
          <AnnotationLayer
            key={shareId}
            meetingId={meetingId}
            shareId={shareId}
            track={track}
            canClear={canClearAll || !sharer}
            canSnapshot={canSnapshot}
          />
        )}
        <Button
          size="sm"
          variant="secondary"
          className="absolute end-3 top-3 z-20 rounded-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
          {expanded ? "Show people" : "Expand"}
        </Button>
      </div>
      {!expanded && (
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
          {[meeting.self, ...others].map((participant) => (
            <RtkParticipantTile
              key={participant.id}
              meeting={meeting}
              participant={participant}
              className="aspect-video w-full shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
};
