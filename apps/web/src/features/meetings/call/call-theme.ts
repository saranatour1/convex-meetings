import { provideRtkDesignSystem } from "@cloudflare/realtimekit-react-ui";

const CALL_THEME = {
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

export const applyCallTheme = (element: HTMLElement | null) => {
  if (element) provideRtkDesignSystem(element, CALL_THEME);
};
