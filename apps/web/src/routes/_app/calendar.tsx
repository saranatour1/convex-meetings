import { createFileRoute } from "@tanstack/react-router";
import { MeetingsCalendar } from "#/features/calendar/meetings-calendar.tsx";
import { parseZones } from "#/lib/zones.ts";

const CalendarPage = () => {
  const { zones, event, declined } = Route.useSearch();
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
        selected={event}
        onSelect={(code) =>
          code !== event &&
          void navigate({
            search: (prev) => ({ ...prev, event: code }),
            replace: true,
            resetScroll: false,
          })
        }
        showDeclined={declined ?? false}
        onShowDeclinedChange={(show) =>
          void navigate({
            search: (prev) => ({ ...prev, declined: show || undefined }),
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
};

export const Route = createFileRoute("/_app/calendar")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { zones?: string[]; event?: string; declined?: true } => ({
    zones: parseZones(search.zones),
    event: typeof search.event === "string" ? search.event : undefined,
    declined: search.declined === true ? true : undefined,
  }),
  component: CalendarPage,
});
