import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "#/features/calendar/meetings-calendar.tsx";
import { parseZones } from "#/lib/schedule.ts";

export const Route = createFileRoute("/_app/calendar")({
  validateSearch: (search: Record<string, unknown>): { zones?: string[] } => ({
    zones: parseZones(search.zones),
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { zones } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col p-4 lg:p-6">
      <MeetingsCalendar
        zone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        zones={zones ?? []}
        onZonesChange={(next) =>
          void navigate({
            search: (prev) => ({ ...prev, zones: next.length ? next : undefined }),
            replace: true,
            resetScroll: false,
          })
        }
        onPlan={(time) =>
          void navigate({ to: "/schedule", search: { start: time.start, minutes: time.minutes } })
        }
      />
    </main>
  );
}
