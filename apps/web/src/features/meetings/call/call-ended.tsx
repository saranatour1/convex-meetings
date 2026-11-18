import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { ArrowLeftIcon, FileTextIcon, PhoneOffIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Skeleton } from "@meetings/ui/components/skeleton";
import { useGuestPass } from "../guest-pass.ts";

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

const RecapOnItsWay = ({ guest }: { guest: boolean }) => (
  <section className="flex w-full flex-col gap-3 rounded-2xl border p-5 text-start">
    <h3 className="flex items-center gap-2 font-semibold text-sm">
      <FileTextIcon className="size-4 opacity-80" />
      Your recap is on its way
    </h3>
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-11/12" />
      <Skeleton className="h-2.5 w-3/5" />
    </div>
    <p className="text-muted-foreground text-sm">
      The summary and transcript show up on the meeting's Recaps tab
      {guest ? "" : " and in your Inbox"} a few minutes after the call ends.
    </p>
  </section>
);

type CallEndedProps = {
  title: string;
  recap: boolean;
  onRejoin: () => void;
  onBack: () => void;
  rejoining: boolean;
  error?: string;
};

export const CallEnded = ({ title, recap, onRejoin, onBack, rejoining, error }: CallEndedProps) => {
  const state = useRealtimeKitSelector((m) => m.self.roomState);
  const pass = useGuestPass();
  const message = error
    ? { title: "Couldn't connect to the call", description: error }
    : (MESSAGES[state] ?? MESSAGES.left!);

  return (
    <div className="grid h-dvh place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
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
        {recap && !error && (state === "left" || state === "ended") && (
          <RecapOnItsWay guest={Boolean(pass.guest)} />
        )}
      </div>
    </div>
  );
};
