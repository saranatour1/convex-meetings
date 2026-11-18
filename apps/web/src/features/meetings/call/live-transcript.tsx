import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { cn } from "@meetings/ui/lib/utils";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatTime } from "#/lib/schedule.ts";

export const LiveTranscript = () => {
  const { transcripts } = useRealtimeKitSelector((m) => m.ai);
  const zone = browserTimeZone();

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Live transcript"
      className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto p-3"
    >
      {transcripts.length ? (
        <ol className="flex flex-col gap-3">
          {transcripts.map((line) => (
            <li key={line.id} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs tabular-nums">
                <span className="font-medium text-foreground">{line.name}</span> ·{" "}
                <time dateTime={line.date.toISOString()}>
                  {formatTime(line.date.getTime(), zone)}
                </time>
              </span>
              <p className={cn("text-sm", line.isPartialTranscript && "text-muted-foreground")}>
                {line.transcript}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nothing said yet. What people say shows up here as text.
        </p>
      )}
    </div>
  );
};
