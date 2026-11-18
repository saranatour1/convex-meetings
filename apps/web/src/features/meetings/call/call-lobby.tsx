import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import {
  RtkAvatar,
  RtkCameraSelector,
  RtkMicrophoneSelector,
  RtkParticipantTile,
  RtkSpeakerSelector,
} from "@cloudflare/realtimekit-react-ui";
import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  ChevronDownIcon,
  MicIcon,
  MicOffIcon,
  MonitorSmartphoneIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@meetings/ui/components/collapsible";
import { toastManager } from "@meetings/ui/components/toast";
import { LiveDot } from "#/components/live-dot.tsx";
import { describeError } from "#/lib/errors.ts";
import { nameList } from "#/lib/names.ts";
import { kindOf, type MeetingKind } from "../meeting-kinds.ts";

const LobbyToggles = ({ kind }: { kind: MeetingKind }) => {
  const { meeting } = useRealtimeKitMeeting();
  const audioOn = useRealtimeKitSelector((m) => m.self.audioEnabled);
  const videoOn = useRealtimeKitSelector((m) => m.self.videoEnabled);
  const audioPermission = useRealtimeKitSelector((m) => m.self.permissions.canProduceAudio);
  const canAudio = audioPermission === "ALLOWED";
  const canVideo = useRealtimeKitSelector((m) => m.self.permissions.canProduceVideo === "ALLOWED");

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {canAudio && (
        <Button
          variant={audioOn ? "outline" : "destructive-outline"}
          className="rounded-full"
          aria-pressed={audioOn}
          onClick={() => void (audioOn ? meeting.self.disableAudio() : meeting.self.enableAudio())}
        >
          {audioOn ? <MicIcon /> : <MicOffIcon />}
          {audioOn ? "Mic on" : "Mic off"}
        </Button>
      )}
      {canVideo && kind !== "audioRoom" && (
        <Button
          variant={videoOn ? "outline" : "destructive-outline"}
          className="rounded-full"
          aria-pressed={videoOn}
          onClick={() => void (videoOn ? meeting.self.disableVideo() : meeting.self.enableVideo())}
        >
          {videoOn ? <VideoIcon /> : <VideoOffIcon />}
          {videoOn ? "Camera on" : "Camera off"}
        </Button>
      )}
      {!canAudio && (
        <span className="text-muted-foreground text-sm">
          {audioPermission === "NOT_ALLOWED"
            ? "You'll join watching and listening. The live transcript is under More."
            : "You'll join listening. Ask to speak once you're in."}
        </span>
      )}
    </div>
  );
};

const WhoIsIn = ({ names }: { names: string[] }) =>
  names.length ? (
    <p className="flex items-center gap-2 text-sm">
      <LiveDot />
      {nameList(names)} {names.length === 1 ? "is" : "are"} in the call
    </p>
  ) : (
    <p className="text-muted-foreground text-sm">Nobody is in yet. You'll be the first.</p>
  );

const JoinState = ({ kind }: { kind: MeetingKind }) => {
  const audioOn = useRealtimeKitSelector((m) => m.self.audioEnabled);
  const videoOn = useRealtimeKitSelector((m) => m.self.videoEnabled);
  const canAudio = useRealtimeKitSelector((m) => m.self.permissions.canProduceAudio === "ALLOWED");
  if (!canAudio) return null;
  const mic = `mic ${audioOn ? "on" : "off"}`;
  const camera = kind === "audioRoom" ? "" : ` and camera ${videoOn ? "on" : "off"}`;
  return (
    <span className="text-center text-muted-foreground text-xs">
      You'll go in with your {mic}
      {camera}.
    </span>
  );
};

const Devices = ({ kind }: { kind: MeetingKind }) => {
  const { meeting } = useRealtimeKitMeeting();

  return (
    <Collapsible className="rounded-xl border">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-start">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-sm">Devices</span>
          <span className="text-muted-foreground text-xs">
            {kind === "audioRoom" ? "Microphone and speaker" : "Microphone, camera and speaker"}
          </span>
        </span>
        <span className="font-medium text-sm">Change</span>
        <ChevronDownIcon className="size-4 opacity-60 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-4 pb-4 [&_rtk-camera-selector]:w-full [&_rtk-microphone-selector]:w-full [&_rtk-speaker-selector]:w-full">
          <RtkMicrophoneSelector meeting={meeting} />
          {kind !== "audioRoom" && <RtkCameraSelector meeting={meeting} />}
          <RtkSpeakerSelector meeting={meeting} />
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
};

type CallLobbyProps = {
  title: string;
  kind: MeetingKind;
  onBack: () => void;
  devicesInCall: number;
  peopleInCall: string[];
  onSwitchHere: () => Promise<unknown>;
};

export const CallLobby = ({
  title,
  kind,
  onBack,
  devicesInCall,
  peopleInCall,
  onSwitchHere,
}: CallLobbyProps) => {
  const { meeting } = useRealtimeKitMeeting();
  const name = useRealtimeKitSelector((m) => m.self.name);
  const waiting = useRealtimeKitSelector((m) => m.self.roomState === "waitlisted");

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon />
          {title}
        </Button>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-4 md:p-8">
        <div className="grid w-full max-w-5xl items-center gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-10">
          <div className="flex flex-col gap-3">
            <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted">
              {kind === "audioRoom" ? (
                <RtkAvatar participant={meeting.self} size="lg" />
              ) : (
                <RtkParticipantTile
                  meeting={meeting}
                  participant={meeting.self}
                  className="size-full rounded-none"
                />
              )}
            </div>
            <LobbyToggles kind={kind} />
          </div>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm">Ready to join?</span>
              <h2 className="font-semibold text-2xl tracking-tight">{title}</h2>
              <span className="text-muted-foreground text-sm">
                {kindOf(kind).label} · you'll join as {name}
              </span>
            </div>
            <WhoIsIn names={peopleInCall} />
            <Devices kind={kind} />
            {devicesInCall > 0 && !waiting && (
              <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <MonitorSmartphoneIcon className="size-4" />
                  You're already in this call on another device
                </span>
                <span className="text-muted-foreground text-xs">
                  Switch here to leave it there, or join on both.
                </span>
                <Button
                  onClick={() =>
                    void onSwitchHere()
                      .then(() => meeting.join())
                      .catch((error: unknown) =>
                        toastManager.add({ title: describeError(error), type: "error" }),
                      )
                  }
                >
                  <ArrowRightLeftIcon />
                  Switch here
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                variant={devicesInCall > 0 && !waiting ? "outline" : "default"}
                disabled={waiting}
                onClick={() =>
                  void meeting.join().catch(() =>
                    toastManager.add({
                      title: "Couldn't join the call. Check your network, then try again.",
                      type: "error",
                    }),
                  )
                }
              >
                {waiting
                  ? "Waiting for the host to let you in…"
                  : devicesInCall > 0
                    ? "Join on this device too"
                    : "Join now"}
              </Button>
              {!waiting && <JoinState kind={kind} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
