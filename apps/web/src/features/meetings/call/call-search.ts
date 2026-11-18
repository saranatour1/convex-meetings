import { PEN_COLORS, type PenColor } from "./pen-colors.ts";
import type { CallSide } from "./call-ui.ts";

const SIDES: CallSide[] = ["chat", "participants", "polls", "plugins", "ai"];

export type CallSearch = {
  call?: true;
  watch?: true;
  side?: CallSide;
  expand?: true;
  draw?: PenColor;
};

const isTrue = (value: unknown) => value === true || value === "true";

export const validateCallSearch = (search: Record<string, unknown>): CallSearch => ({
  call: isTrue(search.call) ? true : undefined,
  watch: isTrue(search.watch) ? true : undefined,
  side: SIDES.find((s) => s === search.side),
  expand: isTrue(search.expand) ? true : undefined,
  draw: PEN_COLORS.find((color) => color === search.draw),
});
