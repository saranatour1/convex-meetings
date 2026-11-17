import { createFileRoute } from "@tanstack/react-router";
import { Dialog, DialogPopup } from "@meetings/ui/components/dialog";
import { MeetingsCalendar } from "#/features/calendar/meetings-calendar.tsx";
import type { ScheduleDisplay } from "#/features/meetings/find-a-time.tsx";
import { ScheduleMeeting } from "#/features/meetings/schedule-meeting.tsx";
import { isTimeZone, parseZones } from "#/lib/zones.ts";

type CalendarSearch = ScheduleDisplay & {
  event?: string;
  declined?: true;
  new?: true;
  start?: number;
  minutes?: number;
};

const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

const CalendarPage = () => {
  const { zones, event, declined, new: scheduling, start, minutes, view, zone } = Route.useSearch();
  const navigate = Route.useNavigate();
  const closeSchedule = (code?: string) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        new: undefined,
        start: undefined,
        minutes: undefined,
        view: undefined,
        zone: undefined,
        event: code ?? prev.event,
      }),
      replace: true,
      resetScroll: false,
    });

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
          void navigate({
            search: (prev) => ({ ...prev, new: true, start: time?.start, minutes: time?.minutes }),
            resetScroll: false,
          })
        }
      />
      <Dialog open={scheduling ?? false} onOpenChange={(open) => !open && closeSchedule()}>
        <DialogPopup
          aria-label="Schedule a meeting"
          showCloseButton={false}
          bottomStickOnMobile={false}
          className="max-w-3xl border-0 bg-transparent shadow-none before:hidden"
        >
          <div className="min-h-0 overflow-y-auto rounded-2xl">
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
              onClose={() => closeSchedule()}
              onScheduled={(code) => closeSchedule(code)}
            />
          </div>
        </DialogPopup>
      </Dialog>
    </main>
  );
};

export const Route = createFileRoute("/_app/calendar")({
  validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
    zones: parseZones(search.zones),
    event: typeof search.event === "string" ? search.event : undefined,
    declined: search.declined === true ? true : undefined,
    new: search.new === true ? true : undefined,
    start: positive(search.start),
    minutes: positive(search.minutes),
    view: search.view === "list" ? "list" : undefined,
    zone: isTimeZone(search.zone) ? search.zone : undefined,
  }),
  component: CalendarPage,
});
