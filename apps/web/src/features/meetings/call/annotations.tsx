import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { CameraIcon, EraserIcon, PencilIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { toastManager } from "@meetings/ui/components/toast";
import { cn } from "@meetings/ui/lib/utils";
import { showError } from "#/lib/errors.ts";
import { useGuestPass } from "../guest-pass.ts";
import { PEN_COLORS, type PenColor } from "./pen-colors.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

const INK: Record<PenColor, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#3b82f6",
  white: "#ffffff",
};

const MAX_COORDS = 1000;
const MIN_STEP = 0.003;

const toPolyline = (points: number[]) =>
  points
    .reduce<string[]>((pairs, value, index) => {
      if (index % 2 === 0) pairs.push(`${value},${points[index + 1] ?? value}`);
      return pairs;
    }, [])
    .join(" ");

type Stroke = { _id: string; color: PenColor; points: number[] };

const drawSnapshot = async (track: MediaStreamTrack, strokes: Stroke[]) => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  await video.play();
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1920;
  canvas.height = video.videoHeight || 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.pause();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(3, canvas.width / 400);
  for (const stroke of strokes) {
    context.strokeStyle = INK[stroke.color];
    context.beginPath();
    for (let index = 0; index < stroke.points.length; index += 2) {
      const x = stroke.points[index]! * canvas.width;
      const y = stroke.points[index + 1]! * canvas.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
};

type AnnotationLayerProps = {
  meetingId: Id<"meetings">;
  shareId: string;
  track: MediaStreamTrack | undefined;
  canClear: boolean;
  canSnapshot: boolean;
};

export const AnnotationLayer = ({
  meetingId,
  shareId,
  track,
  canClear,
  canSnapshot,
}: AnnotationLayerProps) => {
  const { draw } = useSearch({ strict: false });
  const pen = PEN_COLORS.find((color) => color === draw);
  const navigate = useNavigate();
  const pass = useGuestPass();
  const strokes = useConvexValue(api.annotations.strokes, { meetingId, shareId, ...pass }) ?? [];
  const add = useMutation(api.annotations.draw);
  const clear = useMutation(api.annotations.clear);
  const uploadUrl = useMutation(api.annotations.snapshotUploadUrl);
  const save = useMutation(api.annotations.saveSnapshotImage);
  const setPen = (draw: PenColor | undefined) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, draw }),
      replace: true,
      resetScroll: false,
    });
  const settings = track?.getSettings();
  const ratio = settings?.width && settings.height ? settings.width / settings.height : 16 / 9;

  const snapshot = async () => {
    if (!track) return;
    try {
      const image = await drawSnapshot(track, strokes as Stroke[]);
      const url = await uploadUrl({ meetingId, ...pass });
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: image,
      });
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await save({ meetingId, storageId, ...pass });
      toastManager.add({ title: "Saved to this call's recap", type: "success" });
    } catch (error) {
      showError(error);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center [container-type:size]"
        aria-hidden={!pen}
      >
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className={cn("touch-none", pen ? "pointer-events-auto cursor-crosshair" : "")}
          style={{
            width: `min(100cqw, calc(100cqh * ${ratio}))`,
            height: `min(100cqh, calc(100cqw / ${ratio}))`,
          }}
          onPointerDown={(event) => {
            if (!pen) return;
            const svg = event.currentTarget;
            svg.setPointerCapture(event.pointerId);
            const box = svg.getBoundingClientRect();
            const live = svg.querySelector<SVGPolylineElement>("[data-live]");
            const points: number[] = [];
            const push = (x: number, y: number) => {
              const nx = Math.min(1, Math.max(0, (x - box.left) / box.width));
              const ny = Math.min(1, Math.max(0, (y - box.top) / box.height));
              const lx = points[points.length - 2];
              const ly = points[points.length - 1];
              if (
                points.length >= MAX_COORDS ||
                (lx !== undefined && ly !== undefined && Math.hypot(nx - lx, ny - ly) < MIN_STEP)
              ) {
                return;
              }
              points.push(nx, ny);
              live?.setAttribute("points", toPolyline(points));
            };
            push(event.clientX, event.clientY);
            live?.setAttribute("stroke", INK[pen]);
            const move = (next: PointerEvent) => push(next.clientX, next.clientY);
            const up = () => {
              svg.removeEventListener("pointermove", move);
              svg.removeEventListener("pointerup", up);
              svg.removeEventListener("pointercancel", up);
              live?.setAttribute("points", "");
              const finished = points.length === 2 ? [...points, ...points] : points;
              void add({ meetingId, shareId, color: pen, points: finished, ...pass }).catch(
                showError,
              );
            };
            svg.addEventListener("pointermove", move);
            svg.addEventListener("pointerup", up);
            svg.addEventListener("pointercancel", up);
          }}
        >
          {strokes.map((stroke) => (
            <polyline
              key={stroke._id}
              points={toPolyline(stroke.points)}
              fill="none"
              stroke={INK[stroke.color as PenColor]}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            data-live
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="absolute start-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/90 p-1 shadow-sm">
        <Button
          size="sm"
          variant={pen ? "secondary" : "ghost"}
          className="rounded-full"
          aria-pressed={Boolean(pen)}
          onClick={() => setPen(pen ? undefined : "red")}
        >
          <PencilIcon />
          {pen ? "Drawing" : "Annotate"}
        </Button>
        {pen &&
          PEN_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`${color} pen`}
              aria-pressed={pen === color}
              onClick={() => setPen(color)}
              className={cn(
                "size-5 rounded-full border border-black/20",
                pen === color && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
              style={{ backgroundColor: INK[color] }}
            />
          ))}
        {canClear && strokes.length > 0 && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            aria-label="Clear drawing"
            title="Clear drawing"
            onClick={() => void clear({ meetingId, shareId, ...pass }).catch(showError)}
          >
            <EraserIcon />
          </Button>
        )}
        {canSnapshot && track && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            aria-label="Save annotation to the recap"
            title="Save annotation to the recap"
            onClick={() => void snapshot()}
          >
            <CameraIcon />
          </Button>
        )}
      </div>
    </>
  );
};
