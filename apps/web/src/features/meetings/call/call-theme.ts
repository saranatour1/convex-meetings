import { provideRtkDesignSystem } from "@cloudflare/realtimekit-react-ui";
import { resolveTheme } from "#/lib/theme.ts";

const LIGHT = {
  theme: "light",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  borderRadius: "rounded",
  borderWidth: "thin",
  spacingBase: 4,
  colors: {
    brand: { 300: "#52525b", 400: "#3f3f46", 500: "#27272a", 600: "#18181b", 700: "#09090b" },
    background: { 1000: "#ffffff", 900: "#fafafa", 800: "#f4f4f5", 700: "#e4e4e7", 600: "#d4d4d8" },
    text: "#09090b",
    "text-on-brand": "#ffffff",
    "video-bg": "#e4e4e7",
    danger: "#dc2626",
    success: "#16a34a",
    warning: "#d97706",
  },
} as const;

const DARK = {
  ...LIGHT,
  theme: "dark",
  colors: {
    brand: { 300: "#e4e4e7", 400: "#d4d4d8", 500: "#fafafa", 600: "#f4f4f5", 700: "#ffffff" },
    background: { 1000: "#09090b", 900: "#18181b", 800: "#27272a", 700: "#3f3f46", 600: "#52525b" },
    text: "#fafafa",
    "text-on-brand": "#09090b",
    "video-bg": "#27272a",
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
  },
} as const;

export const applyCallTheme = (element: HTMLElement | null) => {
  if (element) provideRtkDesignSystem(element, resolveTheme() === "dark" ? DARK : LIGHT);
};
