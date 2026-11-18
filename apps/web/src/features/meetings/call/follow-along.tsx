import { ArrowLeftIcon } from "lucide-react";
import type { Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { MeetingChat } from "../meeting-chat.tsx";
import { TranscriptFeed } from "../transcript-feed.tsx";

type FollowAlongProps = {
  meetingId: Id<"meetings">;
  title: string;
  moderated: boolean;
  onBack: () => void;
};

export const FollowAlong = ({ meetingId, title, moderated, onBack }: FollowAlongProps) => (
  <div className="flex h-dvh flex-col">
    <header className="flex items-center gap-3 border-b px-4 py-2.5">
      <Button size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeftIcon />
        {title}
      </Button>
    </header>
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">You're in the call, following along as text</h2>
        <p className="text-muted-foreground text-sm">
          Audio and video aren't connected in this browser yet. Everyone sees you in the call, and
          this switches to the call by itself once they connect.
        </p>
      </div>
      <div className="grid min-h-0 gap-6 md:grid-cols-2">
        {!moderated && (
          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="font-medium text-sm">Live transcript</h3>
            <TranscriptFeed meetingId={meetingId} />
          </section>
        )}
        <section className="flex min-h-0 flex-col gap-3">
          <h3 className="font-medium text-sm">Chat</h3>
          <MeetingChat className="h-96" meetingId={meetingId} />
        </section>
      </div>
    </div>
  </div>
);
