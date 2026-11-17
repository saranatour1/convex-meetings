import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { EmptyState } from "#/components/empty-state.tsx";
import { formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";

export type PublicRecapData = FunctionReturnType<typeof api.rooms.recap>;

type PublicRecapProps = { code: string; number: number; initial: PublicRecapData };

export const PublicRecap = ({ code, number, initial }: PublicRecapProps) => {
  const live = useQuery(api.rooms.recap, { code, number });
  const recap = live === undefined ? initial : live;
  const back = (
    <Button
      size="sm"
      variant="ghost"
      className="self-start"
      render={<Link to="/rooms/$code" params={{ code }} />}
    >
      <ArrowLeftIcon />
      Back to the room
    </Button>
  );

  if (!recap) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title="No recap here"
        description="This room has no recap with that number."
        action={back}
      />
    );
  }

  return (
    <article className="flex flex-col gap-6">
      {back}
      <header className="flex flex-col gap-2">
        <h1 className="text-balance font-semibold text-3xl tracking-tight">{recap.title}</h1>
        <p className="text-muted-foreground">{recap.description}</p>
      </header>
      <dl className="grid gap-4 rounded-xl border p-6 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Opened</dt>
          <dd className="tabular-nums">
            {formatDate(recap.startedAt, "UTC")} · {formatTime(recap.startedAt, "UTC")} UTC
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Lasted</dt>
          <dd className="tabular-nums">
            {recap.endedAt
              ? formatDuration(recap.endedAt - recap.startedAt) || "Under a minute"
              : "Still going"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">People</dt>
          <dd className="tabular-nums">{recap.people}</dd>
        </div>
      </dl>
      <section aria-labelledby="recap-summary" className="flex flex-col gap-2">
        <h2 id="recap-summary" className="font-medium">
          Summary
        </h2>
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {recap.summary ?? "There is no summary for this visit."}
        </p>
      </section>
    </article>
  );
};
