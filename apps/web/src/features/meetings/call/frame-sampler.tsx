import { useCallback } from "react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { useGuestPass } from "../guest-pass.ts";

const SAMPLE_MS = 45_000;
const LONG_SIDE = 640;
const SHORT_SIDE = 280;
const QUALITY = 0.7;

const grabFrame = async (track: MediaStreamTrack) => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  try {
    await video.play();
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return null;
    const scale = Math.max(
      LONG_SIDE / Math.max(width, height),
      SHORT_SIDE / Math.min(width, height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
  } finally {
    video.pause();
    video.srcObject = null;
  }
};

export const FrameSampler = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const { meeting } = useRealtimeKitMeeting();
  const { guest } = useGuestPass();
  const uploadUrl = useMutation(api.moderation.frameUploadUrl);
  const submit = useMutation(api.moderation.submitFrame);
  const watch = useQuery(api.moderation.watch, { meetingId, guest });

  const sample = useCallback(
    async (only?: string[]) => {
      const visible = meeting.participants.joined
        .toArray()
        .filter((person) => person.videoEnabled || person.screenShareEnabled)
        .filter((person) => !only || only.includes(person.customParticipantId ?? ""));
      const person = visible[Math.floor(Math.random() * visible.length)];
      const targetMemberId = person?.customParticipantId;
      if (!person || !targetMemberId) return;
      const shared = person.screenShareEnabled ? person.screenShareTracks.video : undefined;
      const camera = person.videoEnabled ? person.videoTrack : undefined;
      const track = shared && (!camera || Math.random() < 0.5) ? shared : camera;
      const frame = track ? await grabFrame(track) : null;
      if (!frame) return;
      const response = await fetch(await uploadUrl({ meetingId, guest }), {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: frame,
      });
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await submit({
        meetingId,
        targetMemberId: targetMemberId as Id<"meetingMembers">,
        storageId,
        guest,
      });
    },
    [meeting, meetingId, guest, uploadUrl, submit],
  );

  const keepSampling = useCallback(
    (element: HTMLSpanElement | null) => {
      if (!element) return;
      const timer = window.setInterval(() => void sample().catch(() => null), SAMPLE_MS);
      return () => window.clearInterval(timer);
    },
    [sample],
  );

  const watched = (watch ?? []).map((entry) => entry.memberId);

  return (
    <>
      <span hidden ref={keepSampling} />
      {watched.length > 0 && (
        <span
          hidden
          key={(watch ?? []).map((entry) => `${entry.memberId}:${entry.at}`).join(",")}
          ref={() => void sample(watched).catch(() => null)}
        />
      )}
    </>
  );
};
