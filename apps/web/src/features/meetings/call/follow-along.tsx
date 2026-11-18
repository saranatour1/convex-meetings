import type { Ref } from "react";
import { ArrowLeftIcon } from "lucide-react";
import type { Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { MeetingChat } from "../meeting-chat.tsx";
import { TranscriptFeed } from "../transcript-feed.tsx";

type FollowAlongProps = {
  meetingId: Id<"meetings">;
  code: string;
  title: string;
  moderated: boolean;
  heading: string;
  description: string;
  backLabel?: string;
  onBack: () => void;
  presence?: Ref<HTMLDivElement>;
};

export const FollowAlong = ({
  meetingId,
  code,
  title,
  moderated,
  heading,
  description,
  backLabel,
  onBack,
  presence,
}: FollowAlongProps) => (
  <div ref={presence} className="flex h-dvh flex-col">
    <header className="flex items-center gap-3 border-b px-4 py-2.5">
      <Button size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeftIcon />
        {backLabel ?? title}
      </Button>
    </header>
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">{heading}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="grid min-h-0 gap-6 md:grid-cols-2">
        {!moderated && (
          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="font-medium text-sm">Live transcript</h3>
            <TranscriptFeed meetingId={meetingId} code={code} />
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
