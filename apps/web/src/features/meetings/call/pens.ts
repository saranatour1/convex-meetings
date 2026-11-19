export const PEN_COLORS = ["red", "yellow", "green", "blue", "white"] as const;
export type PenColor = (typeof PEN_COLORS)[number];

export const PEN_TOOLS = [
  "pen",
  "highlighter",
  "arrow",
  "rectangle",
  "ellipse",
  "text",
  "eraser",
] as const;
export type PenTool = (typeof PEN_TOOLS)[number];
export type MarkTool = Exclude<PenTool, "eraser">;
