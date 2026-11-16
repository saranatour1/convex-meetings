import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { ArrowLeftIcon, PhoneOffIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";

const MESSAGES: Record<string, { title: string; description: string }> = {
  left: { title: "You left the call", description: "The call is still going if others are in it." },
  ended: { title: "The call ended", description: "The host ended it for everyone." },
  kicked: {
    title: "You were removed from the call",
    description: "A host removed you, or you switched to another device.",
  },
  rejected: { title: "You weren't let in", description: "A host declined your request to join." },
  disconnected: {
    title: "Your connection dropped",
    description: "Check your network, then rejoin.",
  },
  failed: {
    title: "Couldn't connect to the call",
    description: "Check your network, then try again.",
  },
};

type CallEndedProps = {
  title: string;
  onRejoin: () => void;
  onBack: () => void;
  rejoining: boolean;
};

export const CallEnded = ({ title, onRejoin, onBack, rejoining }: CallEndedProps) => {
  const state = useRealtimeKitSelector((m) => m.self.roomState);
  const message = MESSAGES[state] ?? MESSAGES.left!;

  return (
    <div className="grid h-dvh place-items-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <PhoneOffIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-lg">{message.title}</h2>
          <p className="text-muted-foreground text-sm">
            {title} · {message.description}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeftIcon />
            Back to meeting
          </Button>
          {state !== "rejected" && (
            <Button disabled={rejoining} onClick={onRejoin}>
              <RotateCwIcon />
              {rejoining ? "Rejoining…" : "Rejoin"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
