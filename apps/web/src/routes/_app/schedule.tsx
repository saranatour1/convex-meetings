import { createFileRoute } from "@tanstack/react-router";
import type { ScheduleDisplay } from "#/features/meetings/find-a-time.tsx";
import { ScheduleForm } from "#/features/meetings/schedule-form.tsx";
import { isTimeZone, parseZones } from "#/lib/schedule.ts";

type ScheduleSearch = ScheduleDisplay & { start?: number; minutes?: number };

const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

export const Route = createFileRoute("/_app/schedule")({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    view: search.view === "list" ? "list" : undefined,
    zone: isTimeZone(search.zone) ? search.zone : undefined,
    zones: parseZones(search.zones),
    openTeam: typeof search.openTeam === "string" ? search.openTeam : undefined,
    start: positive(search.start),
    minutes: positive(search.minutes),
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { view, zone, zones, openTeam, start, minutes } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <ScheduleForm
        initialTime={{ start, minutes }}
        display={{ view, zone, zones, openTeam }}
        onDisplayChange={(display) =>
          void navigate({
            search: (prev) => ({ ...prev, ...display }),
            replace: true,
            resetScroll: false,
          })
        }
        onInvite={(meetingTitle) =>
          void navigate({
            search: (prev) => ({ ...prev, inviteFor: meetingTitle }),
            resetScroll: false,
          })
        }
        onClose={() => void navigate({ to: "/" })}
      />
    </main>
  );
}
