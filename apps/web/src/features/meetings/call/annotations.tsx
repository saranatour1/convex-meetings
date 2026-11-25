import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  ArrowUpRightIcon,
  CameraIcon,
  CircleIcon,
  EraserIcon,
  HighlighterIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Toggle } from "@meetings/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@meetings/ui/components/toggle-group";
import { toastManager } from "@meetings/ui/components/toast";
import { cn } from "@meetings/ui/lib/utils";
import { showError } from "#/lib/errors.ts";
import { useConvexValue } from "#/features/data/live-query.ts";
import { useGuestPass } from "../guest-pass.ts";
import {
  INK,
  NOTE_FONT,
  NOTE_SIZE,
  WIDTH,
  markNote,
  markPaths,
  paintCanvas,
  paintSvg,
  type Mark,
} from "./marks.ts";
import { PEN_COLORS, PEN_TOOLS, type MarkTool, type PenColor, type PenTool } from "./pens.ts";
import { forget, putStep, record, takeStep, useHistory, type History } from "./undo-history.ts";

const TOOLS: { tool: PenTool; label: string; key: string; icon: typeof PencilIcon }[] = [
  { tool: "pen", label: "Pen", key: "P", icon: PencilIcon },
  { tool: "highlighter", label: "Highlighter", key: "H", icon: HighlighterIcon },
  { tool: "arrow", label: "Arrow", key: "A", icon: ArrowUpRightIcon },
  { tool: "rectangle", label: "Rectangle", key: "R", icon: SquareIcon },
  { tool: "ellipse", label: "Ellipse", key: "O", icon: CircleIcon },
  { tool: "text", label: "Text note", key: "T", icon: TypeIcon },
  { tool: "eraser", label: "Eraser", key: "E", icon: EraserIcon },
];

const MAX_COORDS = 1000;
const MIN_STEP = 0.003;
const MIN_SHAPE = 0.005;
const MAX_ERASE = 100;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const isTyping = (target: EventTarget | null) =>
  Boolean(
    (target as Partial<Element> | null)?.closest?.(
      "input, textarea, [contenteditable]:not([contenteditable='false'])",
    ),
  );

type ClientPoint = { clientX: number; clientY: number };

const followPointer = (
  svg: SVGSVGElement,
  event: React.PointerEvent,
  onPoint: (x: number, y: number, client: ClientPoint) => void,
  onEnd: () => void,
) => {
  svg.setPointerCapture(event.pointerId);
  const box = svg.getBoundingClientRect();
  const at = (point: ClientPoint) =>
    onPoint(
      clamp((point.clientX - box.left) / box.width),
      clamp((point.clientY - box.top) / box.height),
      point,
    );
  at(event);
  const move = (next: PointerEvent) => at(next);
  const up = () => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", up);
    svg.removeEventListener("pointercancel", up);
    onEnd();
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
};

const drawSnapshot = async (track: MediaStreamTrack, marks: Mark[], height: number) => {
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
  paintCanvas(context, marks, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
};

const MarkView = ({
  mark,
  height,
  erasable,
}: {
  mark: Mark;
  height: number;
  erasable: boolean;
}) => {
  const paths = markPaths(mark, height);
  const note = markNote(mark, height);
  return (
    <g data-mark-id={mark._id} data-erasable={erasable ? "" : undefined}>
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={path.fill ?? "none"}
          stroke={path.stroke}
          strokeWidth={path.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={path.opacity}
        />
      ))}
      {erasable &&
        paths.map((path, index) => (
          <path key={`hit-${index}`} d={path.d} fill="none" stroke="transparent" strokeWidth={18} />
        ))}
      {note && (
        <text
          x={note.x}
          y={note.y}
          fill={note.color}
          stroke="rgba(0, 0, 0, 0.6)"
          strokeWidth={4}
          paintOrder="stroke"
          dominantBaseline="hanging"
          style={{ font: NOTE_FONT }}
        >
          {note.text}
        </text>
      )}
    </g>
  );
};

const Divider = () => <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />;

type AnnotationLayerProps = {
  meetingId: Id<"meetings">;
  shareId: string;
  track: MediaStreamTrack | undefined;
  canSnapshot: boolean;
  floating?: boolean;
};

export const AnnotationLayer = ({
  meetingId,
  shareId,
  track,
  canSnapshot,
  floating = false,
}: AnnotationLayerProps) => {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const pass = useGuestPass();
  const data = useConvexValue(api.annotations.strokes, { meetingId, shareId, ...pass });
  const marks = data?.strokes ?? [];
  const canDraw = Boolean(data && (!data.locked || data.presenter));
  const tool = canDraw ? PEN_TOOLS.find((entry) => entry === search.draw) : undefined;
  const ink = PEN_COLORS.find((color) => color === search.ink) ?? "red";
  const history = useHistory(shareId);
  const draw = useMutation(api.annotations.draw);
  const remove = useMutation(api.annotations.remove);
  const restore = useMutation(api.annotations.restore);
  const lock = useMutation(api.annotations.lock);
  const clear = useMutation(api.annotations.clear);
  const uploadUrl = useMutation(api.annotations.snapshotUploadUrl);
  const save = useMutation(api.annotations.saveSnapshotImage);
  const settings = track?.getSettings();
  const ratio = settings?.width && settings.height ? settings.width / settings.height : 16 / 9;
  const height = WIDTH / ratio;
  const share = { meetingId, shareId, ...pass };

  const setSearch = (next: { draw?: PenTool; ink?: PenColor }) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
      replace: true,
      resetScroll: false,
    });

  const addMark = (mark: { tool: MarkTool; points: number[]; text?: string }, pending?: Element) =>
    draw({ ...share, color: ink, ...mark })
      .then((id) => record(shareId, { kind: "add", ids: [id] }))
      .catch(showError)
      .finally(() => pending?.remove());

  const walk = (from: keyof History): Promise<void> => {
    const step = takeStep(shareId, from);
    if (!step) return Promise.resolve();
    const removing = (step.kind === "add") === (from === "undo");
    const ids = step.ids as Id<"strokes">[];
    return (removing ? remove : restore)({ ...share, ids }).then(
      (changed) =>
        changed > 0 ? putStep(shareId, from === "undo" ? "redo" : "undo", step) : walk(from),
      (error: unknown) => {
        putStep(shareId, from, step);
        showError(error);
      },
    );
  };

  const undo = () => void walk("undo");

  const redo = () => void walk("redo");

  const snapshot = async () => {
    if (!track) return;
    try {
      const image = await drawSnapshot(track, marks, height);
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

  const openNote = (svg: SVGSVGElement, x: number, y: number) => {
    const input = svg.parentElement?.querySelector<HTMLInputElement>("input[data-note]");
    if (!input) return;
    if (!input.hidden) input.blur();
    input.value = "";
    input.style.left = `${x * 100}%`;
    input.style.top = `${y * 100}%`;
    input.style.color = INK[ink];
    input.style.fontSize = `${(svg.getBoundingClientRect().width * NOTE_SIZE) / WIDTH}px`;
    input.hidden = false;
    const finish = (keep: boolean) => {
      input.onkeydown = null;
      input.onblur = null;
      input.hidden = true;
      const text = input.value.trim();
      if (keep && text) void addMark({ tool: "text", points: [x, y], text });
    };
    input.onkeydown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    };
    input.onblur = () => finish(true);
    input.focus();
  };

  const erase = (svg: SVGSVGElement, event: React.PointerEvent) => {
    const hits = new Set<string>();
    followPointer(
      svg,
      event,
      (_x, _y, point) => {
        const target = svg.ownerDocument
          .elementFromPoint(point.clientX, point.clientY)
          ?.closest("[data-erasable]");
        const id = target?.getAttribute("data-mark-id");
        if (!target || !id || hits.has(id) || hits.size >= MAX_ERASE) return;
        hits.add(id);
        target.setAttribute("opacity", "0.3");
      },
      () => {
        const ids = [...hits];
        if (!ids.length) return;
        void remove({ ...share, ids: ids as Id<"strokes">[] })
          .then(() => record(shareId, { kind: "remove", ids }))
          .catch(showError);
      },
    );
  };

  const startMark = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!tool || event.button !== 0) return;
    const svg = event.currentTarget;
    if (tool === "text") {
      event.preventDefault();
      const box = svg.getBoundingClientRect();
      openNote(
        svg,
        clamp((event.clientX - box.left) / box.width),
        clamp((event.clientY - box.top) / box.height),
      );
      return;
    }
    if (tool === "eraser") return erase(svg, event);
    const markTool: MarkTool = tool;
    const freehand = markTool === "pen" || markTool === "highlighter";
    const pending = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.querySelector("[data-pending]")?.append(pending);
    const points: number[] = [];
    followPointer(
      svg,
      event,
      (x, y) => {
        if (!freehand) {
          if (points.length < 2) points.push(x, y);
          else points.splice(2, 2, x, y);
        } else {
          const lastX = points.at(-2);
          const lastY = points.at(-1);
          const tooClose =
            lastX !== undefined &&
            lastY !== undefined &&
            Math.hypot(x - lastX, y - lastY) < MIN_STEP;
          if (points.length >= MAX_COORDS || tooClose) return;
          points.push(x, y);
        }
        paintSvg(pending, { _id: "pending", tool: markTool, color: ink, points }, height);
      },
      () => {
        const [x1 = 0, y1 = 0, x2 = x1, y2 = y1] = points;
        if (!freehand && Math.hypot(x2 - x1, y2 - y1) < MIN_SHAPE) return pending.remove();
        void addMark({ tool: markTool, points: freehand ? points : [x1, y1, x2, y2] }, pending);
      },
    );
  };

  const listenForShortcuts = (root: HTMLDivElement | null) => {
    if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      if (!tool || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key !== "z" && key !== "y") return;
        event.preventDefault();
        if (key === "y" || event.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "escape") return setSearch({ draw: undefined });
      const next = TOOLS.find((entry) => entry.key.toLowerCase() === key)?.tool;
      if (next) return setSearch({ draw: next });
      const color = PEN_COLORS[Number(key) - 1];
      if (color) setSearch({ ink: color });
    };
    const target = root.ownerDocument;
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  };

  const snapshotButton = canSnapshot && track && (
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
  );

  return (
    <div ref={listenForShortcuts} className="contents">
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center [container-type:size]"
        aria-hidden={!tool}
      >
        <div
          className="relative"
          style={{
            width: `min(100cqw, calc(100cqh * ${ratio}))`,
            height: `min(100cqh, calc(100cqw / ${ratio}))`,
          }}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${height}`}
            className={cn(
              "size-full touch-none select-none",
              tool && "pointer-events-auto cursor-crosshair",
              tool === "text" && "cursor-text",
              tool === "eraser" && "cursor-cell",
            )}
            onPointerDown={startMark}
          >
            {marks.map((mark) => (
              <MarkView
                key={mark._id}
                mark={mark}
                height={height}
                erasable={tool === "eraser" && (mark.mine || Boolean(data?.canClear))}
              />
            ))}
            <g data-pending />
          </svg>
          <input
            data-note
            hidden
            maxLength={280}
            aria-label="Note"
            className="pointer-events-auto absolute min-w-40 rounded-sm bg-black/50 px-1 font-semibold outline-none ring-2 ring-white/70"
          />
        </div>
      </div>
      {data && (
        <div
          role="toolbar"
          aria-label="Annotation"
          className={cn(
            "absolute start-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-2xl border bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur",
            floating ? "top-1" : "top-3",
          )}
        >
          {tool ? (
            <>
              <ToggleGroup
                size="sm"
                aria-label="Tool"
                value={[tool]}
                onValueChange={(value) => {
                  const next = PEN_TOOLS.find((entry) => entry === value[0]);
                  if (next) setSearch({ draw: next });
                }}
              >
                {TOOLS.map((entry) => (
                  <ToggleGroupItem
                    key={entry.tool}
                    value={entry.tool}
                    aria-label={entry.label}
                    title={`${entry.label} (${entry.key})`}
                  >
                    <entry.icon />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Divider />
              {PEN_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${color} ink`}
                  title={`${color} (${index + 1})`}
                  aria-pressed={ink === color}
                  onClick={() => setSearch({ ink: color })}
                  className={cn(
                    "mx-0.5 size-5 rounded-full border border-black/20",
                    ink === color && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                  )}
                  style={{ backgroundColor: INK[color] }}
                />
              ))}
              <Divider />
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!history.undo.length}
                onClick={undo}
              >
                <Undo2Icon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!history.redo.length}
                onClick={redo}
              >
                <Redo2Icon />
              </Button>
              {data.canClear && (
                <>
                  <Divider />
                  <Toggle
                    size="sm"
                    aria-label={data.presenter ? "Only I can draw" : "Only the presenter can draw"}
                    title={
                      data.locked
                        ? "Only the presenter can draw. Press to let everyone draw"
                        : "Everyone can draw. Press to let only the presenter draw"
                    }
                    pressed={data.locked}
                    onPressedChange={(locked) => void lock({ ...share, locked }).catch(showError)}
                  >
                    {data.locked ? <LockIcon /> : <LockOpenIcon />}
                  </Toggle>
                  {marks.length > 0 && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-full"
                      aria-label="Clear drawing"
                      title="Clear everyone's drawing"
                      onClick={() =>
                        void clear(share)
                          .then(() => forget(shareId))
                          .catch(showError)
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </>
              )}
              {snapshotButton}
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label="Close annotation"
                title="Close (Esc)"
                onClick={() => setSearch({ draw: undefined })}
              >
                <XIcon />
              </Button>
            </>
          ) : (
            <>
              {canDraw ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setSearch({ draw: "pen" })}
                >
                  <PencilIcon />
                  Annotate
                </Button>
              ) : (
                <span className="flex items-center gap-1.5 px-2 text-muted-foreground text-xs">
                  <LockIcon className="size-3.5" />
                  The presenter turned drawing off
                </span>
              )}
              {snapshotButton}
            </>
          )}
        </div>
      )}
    </div>
  );
};
