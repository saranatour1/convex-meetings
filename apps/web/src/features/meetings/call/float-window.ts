import { useSyncExternalStore } from "react";

type PictureInPicture = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

const pictureInPicture = () =>
  typeof window === "undefined"
    ? undefined
    : (window as { documentPictureInPicture?: PictureInPicture }).documentPictureInPicture;

let current: Window | null = null;
const listeners = new Set<() => void>();

const set = (next: Window | null) => {
  current = next;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const copyStyles = (target: Document) => {
  for (const sheet of document.styleSheets) {
    try {
      const style = target.createElement("style");
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      target.head.append(style);
    } catch {
      if (!sheet.href) continue;
      const link = target.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.head.append(link);
    }
  }
  target.documentElement.className = document.documentElement.className;
  target.body.className = "bg-neutral-950 text-foreground";
};

export const canFloat = () => pictureInPicture() !== undefined;

export const openFloat = async () => {
  const api = pictureInPicture();
  if (!api || current) return;
  const floating = await api.requestWindow({ width: 640, height: 440 });
  copyStyles(floating.document);
  floating.document.title = "Draw on your share";
  floating.addEventListener("pagehide", () => set(null), { once: true });
  set(floating);
};

export const closeFloat = () => current?.close();

export const closeFloatOnUnmount = () => closeFloat;

export const useFloatWindow = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
