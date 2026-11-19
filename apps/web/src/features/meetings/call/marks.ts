import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import type { MarkTool, PenColor } from "./pens.ts";

export const INK: Record<PenColor, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#3b82f6",
  white: "#ffffff",
};

export const WIDTH = 1000;
export const NOTE_SIZE = 28;
export const NOTE_FONT = `600 ${NOTE_SIZE}px Inter, ui-sans-serif, system-ui, sans-serif`;

export type Mark = {
  _id: string;
  tool: MarkTool;
  color: PenColor;
  points: number[];
  text?: string;
};

export type MarkPath = {
  d: string;
  fill?: string;
  stroke?: string;
  width: number;
  opacity: number;
};

const generator = rough.generator();

const seedOf = (id: string) => {
  let hash = 7;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash % 2 ** 31) + 1;
};

const pairsOf = (points: number[], height: number) => {
  const pairs: [number, number][] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pairs.push([points[index]! * WIDTH, points[index + 1]! * height]);
  }
  return pairs;
};

const freehand = (pairs: [number, number][], color: string, highlighter: boolean): MarkPath => {
  const outline = getStroke(pairs, {
    size: highlighter ? 22 : 6,
    thinning: highlighter ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !highlighter,
    last: true,
  });
  const d = outline.length
    ? `M${outline.map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join("L")}Z`
    : "";
  return { d, fill: color, width: 0, opacity: highlighter ? 0.35 : 1 };
};

const arrowHead = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.min(30, Math.hypot(x2 - x1, y2 - y1) * 0.4);
  const wing = (turn: number): [number, number] => [
    x2 - length * Math.cos(angle + turn),
    y2 - length * Math.sin(angle + turn),
  ];
  return [wing(0.45), [x2, y2], wing(-0.45)] satisfies [number, number][];
};

export const markPaths = (mark: Mark, height: number): MarkPath[] => {
  const color = INK[mark.color];
  const pairs = pairsOf(mark.points, height);
  if (mark.tool === "text") return [];
  if (mark.tool === "pen" || mark.tool === "highlighter") {
    return [freehand(pairs, color, mark.tool === "highlighter")];
  }
  const [start, end] = pairs;
  if (!start || !end) return [];
  const options = { seed: seedOf(mark._id), stroke: color, strokeWidth: 3, roughness: 1.2 };
  const [x1, y1] = start;
  const [x2, y2] = end;
  const drawables =
    mark.tool === "rectangle"
      ? [generator.rectangle(x1, y1, x2 - x1, y2 - y1, options)]
      : mark.tool === "ellipse"
        ? [
            generator.ellipse(
              (x1 + x2) / 2,
              (y1 + y2) / 2,
              Math.abs(x2 - x1),
              Math.abs(y2 - y1),
              options,
            ),
          ]
        : [
            generator.line(x1, y1, x2, y2, options),
            generator.linearPath(arrowHead(start, end), options),
          ];
  return drawables.flatMap((drawable) =>
    generator.toPaths(drawable).map((path) => ({
      d: path.d,
      fill: path.fill && path.fill !== "none" ? path.fill : undefined,
      stroke: path.stroke,
      width: path.strokeWidth,
      opacity: 1,
    })),
  );
};

export const markNote = (mark: Mark, height: number) => {
  const [x = 0, y = 0] = mark.points;
  return mark.tool === "text" && mark.text
    ? { text: mark.text, x: x * WIDTH, y: y * height, color: INK[mark.color] }
    : undefined;
};

const SVG = "http://www.w3.org/2000/svg";

export const paintSvg = (group: SVGGElement, mark: Mark, height: number) => {
  const document = group.ownerDocument;
  group.replaceChildren(
    ...markPaths(mark, height).map((path) => {
      const element = document.createElementNS(SVG, "path");
      element.setAttribute("d", path.d);
      element.setAttribute("fill", path.fill ?? "none");
      element.setAttribute("opacity", String(path.opacity));
      if (path.stroke) {
        element.setAttribute("stroke", path.stroke);
        element.setAttribute("stroke-width", String(path.width));
        element.setAttribute("stroke-linecap", "round");
      }
      return element;
    }),
  );
};

export const paintCanvas = (context: CanvasRenderingContext2D, marks: Mark[], height: number) => {
  context.save();
  context.scale(context.canvas.width / WIDTH, context.canvas.height / height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const mark of marks) {
    for (const path of markPaths(mark, height)) {
      const shape = new Path2D(path.d);
      context.globalAlpha = path.opacity;
      if (path.fill) {
        context.fillStyle = path.fill;
        context.fill(shape);
      }
      if (path.stroke) {
        context.strokeStyle = path.stroke;
        context.lineWidth = path.width;
        context.stroke(shape);
      }
    }
    context.globalAlpha = 1;
    const note = markNote(mark, height);
    if (note) {
      context.font = NOTE_FONT;
      context.textBaseline = "top";
      context.lineWidth = 4;
      context.strokeStyle = "rgba(0, 0, 0, 0.6)";
      context.strokeText(note.text, note.x, note.y);
      context.fillStyle = note.color;
      context.fillText(note.text, note.x, note.y);
    }
  }
  context.restore();
};
