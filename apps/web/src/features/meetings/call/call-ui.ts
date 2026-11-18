export type CallSide = "chat" | "participants" | "polls" | "plugins" | "ai";

export const RTK_SECTIONS: CallSide[] = ["participants", "polls", "plugins"];

export const emitCallUi = (element: Element | null, detail: Record<string, unknown>) =>
  element?.dispatchEvent(
    new CustomEvent("rtkStateUpdate", { detail, bubbles: true, composed: true }),
  );

const pluginFrame = (src: string) => {
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.allow = "clipboard-read; clipboard-write; fullscreen";
  frame.style.cssText = "width:100%;height:100%;border:0;";
  return frame;
};

export const whiteboardPlugin = (authToken: string) => ({
  id: "whiteboard",
  name: "Whiteboard",
  icon: "https://cdn.jsdelivr.net/npm/lucide-static@0.469.0/icons/presentation.svg",
  permissions: { canActivate: true, canDeactivate: true },
  component: pluginFrame(
    `https://whiteboard-v2.plugins.realtime.cloudflare.com/#authToken=${authToken}`,
  ),
});
