import type { ReactNode } from "react";
import { cn } from "@meetings/ui/lib/utils";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatTime } from "#/lib/schedule.ts";

export type TranscriptLine = {
  id: string;
  name: string;
  at: number;
  text: string;
  imageUrl?: string | null;
  partial?: boolean;
};

type TranscriptListProps = {
  lines: TranscriptLine[];
  empty: string;
  earlier?: ReactNode;
  className?: string;
};

export const TranscriptList = ({ lines, empty, earlier, className }: TranscriptListProps) => {
  const zone = browserTimeZone();

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Live transcript"
      className={cn("flex min-h-0 flex-col-reverse overflow-y-auto", className)}
    >
      {lines.length ? (
        <div className="flex flex-col gap-3">
          {earlier}
          <ol className="flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
                  {line.imageUrl && (
                    <img src={line.imageUrl} alt="" className="size-4 rounded-full" />
                  )}
                  <span className="font-medium text-foreground">{line.name}</span> ·{" "}
                  <time dateTime={new Date(line.at).toISOString()}>
                    {formatTime(line.at, zone)}
                  </time>
                </span>
                <p className={cn("text-sm", line.partial && "text-muted-foreground")}>
                  {line.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{empty}</p>
      )}
    </div>
  );
};
