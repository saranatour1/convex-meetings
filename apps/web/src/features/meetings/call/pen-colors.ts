export const PEN_COLORS = ["red", "yellow", "green", "blue", "white"] as const;
export type PenColor = (typeof PEN_COLORS)[number];
