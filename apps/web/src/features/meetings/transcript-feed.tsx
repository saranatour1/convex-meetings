import { usePaginatedQuery } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { useGuestPass } from "./guest-pass.ts";
import { TranscriptList } from "./transcript-list.tsx";

export const TranscriptFeed = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const pass = useGuestPass();
  const { results, status, loadMore } = usePaginatedQuery(
    api.transcripts.live,
    { meetingId, ...pass },
    { initialNumItems: 100 },
  );

  return (
    <TranscriptList
      className="max-h-96"
      empty="While a call is going, what people say in it shows up here as text, even if you're not in the call."
      lines={[...results].reverse().map((line) => ({
        id: line._id,
        name: line.name,
        at: line.at,
        text: line.text,
      }))}
      earlier={
        status === "CanLoadMore" && (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => loadMore(100)}>
            Show earlier
          </Button>
        )
      }
    />
  );
};
