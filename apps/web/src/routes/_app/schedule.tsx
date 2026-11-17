import { createFileRoute } from "@tanstack/react-router";
import type { ScheduleDisplay } from "#/features/meetings/find-a-time.tsx";
import { ScheduleMeeting } from "#/features/meetings/schedule-meeting.tsx";
import { isTimeZone, parseZones } from "#/lib/zones.ts";

type ScheduleSearch = ScheduleDisplay & { start?: number; minutes?: number };

const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

const SchedulePage = () => {
  const { view, zone, zones, start, minutes } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <ScheduleMeeting
        initialTime={{ start, minutes }}
        display={{ view, zone, zones }}
        onDisplayChange={(display) =>
          void navigate({
            search: (prev) => ({ ...prev, ...display }),
            replace: true,
            resetScroll: false,
          })
        }
        onClose={() => void navigate({ to: "/home" })}
        onScheduled={(code) => void navigate({ to: "/meetings/$code", params: { code } })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/schedule")({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    view: search.view === "list" ? "list" : undefined,
    zone: isTimeZone(search.zone) ? search.zone : undefined,
    zones: parseZones(search.zones),
    start: positive(search.start),
    minutes: positive(search.minutes),
  }),
  component: SchedulePage,
});
