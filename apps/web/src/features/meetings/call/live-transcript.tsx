import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { TranscriptList } from "../transcript-list.tsx";

export const LiveTranscript = () => {
  const { transcripts } = useRealtimeKitSelector((m) => m.ai);

  return (
    <TranscriptList
      className="flex-1 p-3"
      empty="Nothing said yet. What people say shows up here as text."
      lines={transcripts.map((line) => ({
        id: line.id,
        name: line.name,
        at: line.date.getTime(),
        text: line.transcript,
        partial: line.isPartialTranscript,
      }))}
    />
  );
};
