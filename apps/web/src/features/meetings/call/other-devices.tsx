import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { LogOutIcon, MicOffIcon, MonitorSmartphoneIcon, VideoOffIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { toastManager } from "@meetings/ui/components/toast";

const OWN_DEVICE = "own-device";

type DeviceAction = "mute" | "camera" | "leave";

type Meeting = ReturnType<typeof useRealtimeKitMeeting>["meeting"];

const NOTICE: Record<DeviceAction, string> = {
  mute: "Your other device muted this one",
  camera: "Your other device turned this camera off",
  leave: "You moved to your other device",
};

export const listenToOwnDevices = (meeting: Meeting) => {
  const handle = ({ type, payload }: { type: string; payload: Record<string, unknown> }) => {
    if (type !== OWN_DEVICE || payload.userId !== meeting.self.userId) return;
    const action = payload.action as DeviceAction;
    if (action === "mute") void meeting.self.disableAudio();
    if (action === "camera") void meeting.self.disableVideo();
    if (action === "leave") void meeting.leave();
    if (NOTICE[action]) toastManager.add({ title: NOTICE[action], type: "info" });
  };
  meeting.participants.on("broadcastedMessage", handle);
  return () => {
    meeting.participants.off("broadcastedMessage", handle);
  };
};

const DEVICE_SEPARATOR = ",";

export const OtherDevices = () => {
  const { meeting } = useRealtimeKitMeeting();
  const key = useRealtimeKitSelector((m) =>
    m.participants.joined
      .toArray()
      .filter((p) => p.userId === m.self.userId)
      .map((p) => `${p.id}|${p.audioEnabled ? 1 : 0}|${p.videoEnabled ? 1 : 0}`)
      .join(DEVICE_SEPARATOR),
  );
  if (!key) return null;
  const devices = key.split(DEVICE_SEPARATOR).map((entry) => {
    const [id, audio, video] = entry.split("|");
    return { id: id ?? "", audio: audio === "1", video: video === "1" };
  });
  const send = (peerIds: string[], action: DeviceAction) =>
    void meeting.participants.broadcastMessage(
      OWN_DEVICE,
      { action, userId: meeting.self.userId },
      { participantIds: peerIds },
    );
  const ids = devices.map((device) => device.id);
  const anyAudio = devices.some((device) => device.audio);
  const anyVideo = devices.some((device) => device.video);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-warning/10 px-4 py-2 text-sm">
      <MonitorSmartphoneIcon className="size-4 shrink-0" />
      <span className="me-auto">
        You're also in this call on{" "}
        {devices.length === 1 ? "another device" : `${devices.length} other devices`}
        {anyAudio && ", and its mic is on"}.
      </span>
      {anyAudio && (
        <Button size="xs" variant="outline" onClick={() => send(ids, "mute")}>
          <MicOffIcon />
          Mute it
        </Button>
      )}
      {anyVideo && (
        <Button size="xs" variant="outline" onClick={() => send(ids, "camera")}>
          <VideoOffIcon />
          Turn off its camera
        </Button>
      )}
      <Button size="xs" variant="outline" onClick={() => send(ids, "leave")}>
        <LogOutIcon />
        Remove it
      </Button>
    </div>
  );
};
