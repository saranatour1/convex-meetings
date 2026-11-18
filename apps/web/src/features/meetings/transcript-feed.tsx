import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useConvex } from "convex/react";
import type { Id } from "@meetings/backend";
import { useGuestPass } from "./guest-pass.ts";
import { liveTranscript, meetingPeople } from "./live-collections.ts";
import { TranscriptList } from "./transcript-list.tsx";

type TranscriptFeedProps = { meetingId: Id<"meetings">; code: string; className?: string };

export const TranscriptFeed = ({
  meetingId,
  code,
  className = "max-h-96",
}: TranscriptFeedProps) => {
  const client = useConvex();
  const pass = useGuestPass();
  const lines = liveTranscript(client, meetingId, pass);
  const people = meetingPeople(client, code, pass);
  const { data } = useLiveQuery((q) =>
    q
      .from({ line: lines })
      .leftJoin({ person: people }, ({ line, person }) => eq(line.memberId, person._id))
      .orderBy(({ line }) => line.at, "asc"),
  );

  return (
    <TranscriptList
      className={className}
      empty="While a call is going, what people say in it shows up here as text, even if you're not in the call."
      lines={data.map(({ line, person }) => ({
        id: line._id,
        name: person?.name ?? line.name,
        at: line.at,
        text: line.text,
        imageUrl: person?.imageUrl,
      }))}
    />
  );
};
