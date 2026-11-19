import { PEN_COLORS, PEN_TOOLS, type PenColor, type PenTool } from "./pens.ts";
import type { CallSide } from "./call-ui.ts";

const SIDES: CallSide[] = ["chat", "participants", "polls", "plugins", "ai"];

export type CallSearch = {
  call?: true;
  watch?: true;
  side?: CallSide;
  expand?: true;
  draw?: PenTool;
  ink?: PenColor;
};

const isTrue = (value: unknown) => value === true || value === "true";

export const validateCallSearch = (search: Record<string, unknown>): CallSearch => ({
  call: isTrue(search.call) ? true : undefined,
  watch: isTrue(search.watch) ? true : undefined,
  side: SIDES.find((s) => s === search.side),
  expand: isTrue(search.expand) ? true : undefined,
  draw: PEN_TOOLS.find((tool) => tool === search.draw),
  ink: PEN_COLORS.find((color) => color === search.ink),
});
