import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { RtkParticipantTile, RtkScreenshareView } from "@cloudflare/realtimekit-react-ui";
import { Maximize2Icon, Minimize2Icon, MonitorUpIcon, PictureInPicture2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { showError } from "#/lib/errors.ts";
import { AnnotationLayer } from "./annotations.tsx";
import { canFloat, closeFloatOnUnmount, openFloat, useFloatWindow } from "./float-window.ts";

const ShareVideo = ({ track }: { track: MediaStreamTrack | undefined }) => (
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
);

const SelfShare = ({ floatingLayer }: { floatingLayer: ReactNode }) => {
  const { meeting } = useRealtimeKitMeeting();
  const track = useRealtimeKitSelector((m) => m.self.screenShareTracks?.video);
  const floating = useFloatWindow();

  return (
    <div className="relative size-full" ref={closeFloatOnUnmount}>
      <ShareVideo track={track} />
      {floating &&
        createPortal(
          <div className="relative h-dvh w-full">
            <ShareVideo track={track} />
            {floatingLayer}
          </div>,
          floating.document.body,
        )}
      <div className="absolute start-3 bottom-3 flex items-center gap-2 rounded-full bg-background/90 py-1 ps-3 pe-1 text-xs shadow-sm">
        <MonitorUpIcon className="size-3.5" />
        You're sharing your screen
        {floatingLayer && !floating && canFloat() && (
          <Button
            size="xs"
            variant="secondary"
            className="rounded-full"
            title="Open your share and everyone's drawings in a small window that stays on top of your other apps"
            onClick={() => void openFloat().catch(showError)}
          >
            <PictureInPicture2Icon />
            See drawings
          </Button>
        )}
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
  annotate: boolean;
  canSnapshot: boolean;
};

export const ShareStage = ({
  meetingId,
  sharerId,
  expanded,
  onExpandedChange,
  annotate,
  canSnapshot,
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
          <SelfShare
            floatingLayer={
              shareId && annotate ? (
                <AnnotationLayer
                  meetingId={meetingId}
                  shareId={shareId}
                  track={track}
                  canSnapshot={canSnapshot}
                  floating
                />
              ) : null
            }
          />
        )}
        {shareId && annotate && (
          <AnnotationLayer
            key={shareId}
            meetingId={meetingId}
            shareId={shareId}
            track={track}
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
