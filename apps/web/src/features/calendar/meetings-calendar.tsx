import { useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@meetings/backend";
import { Link } from "@tanstack/react-router";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Kloq, KloqNav, KloqToolbar, formatInstant, type CalEvent } from "@meetings/ui/kloq";
import type { MeetingTime } from "#/features/meetings/find-a-time.tsx";
import { kindOf } from "#/features/meetings/meeting-kinds.ts";
import { ZonePicker } from "#/features/meetings/zone-picker.tsx";
import { MINUTE, cityOf, formatOffset } from "#/lib/schedule.ts";

type MeetingsCalendarProps = {
  zone: string;
  zones: string[];
  onZonesChange: (zones: string[]) => void;
  onPlan: (time: MeetingTime) => void;
};

export const MeetingsCalendar = ({ zone, zones, onZonesChange, onPlan }: MeetingsCalendarProps) => {
  const meetings = usePaginatedQuery(api.meetings.mine, {}, { initialNumItems: 200 });
  const events = useMemo(
    () =>
      meetings.results
        .filter((m) => m.response !== "declined")
        .map((m): CalEvent => ({
          id: m._id,
          title: m.title,
          color: kindOf(m.kind).color,
          rrule: m.rrule ?? undefined,
          start: formatInstant(new Date(m.startsAt), m.timeZone),
          end: formatInstant(new Date(m.endsAt), m.timeZone),
          timeZone: m.timeZone,
        })),
    [meetings.results],
  );

  return (
    <Kloq
      key={events.map((e) => e.id).join()}
      className="overflow-hidden rounded-2xl border"
      defaultEvents={events}
      persistence={false}
      storage={false}
      designMode={false}
      displayTimeZone={zone}
      timeZones={zones}
      onSlotClick={(slot) =>
        !slot.allDay &&
        onPlan({
          start: slot.start.getTime(),
          minutes: Math.round((slot.end.getTime() - slot.start.getTime()) / MINUTE),
        })
      }
    >
      <KloqToolbar>
        <KloqNav />
        <div className="flex flex-wrap items-center gap-2">
          {zones.map((z) => (
            <span
              key={z}
              className="flex h-7 items-center gap-1 rounded-full border ps-2.5 pe-0.5 text-sm"
            >
              {cityOf(z)}
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatOffset(Date.now(), z)}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                className="rounded-full"
                aria-label={`Stop showing ${cityOf(z)}`}
                onClick={() => onZonesChange(zones.filter((x) => x !== z))}
              >
                <XIcon />
              </Button>
            </span>
          ))}
          <ZonePicker
            label="Add a time zone"
            placeholder="Add a time zone"
            onChange={(next) =>
              next !== zone && !zones.includes(next) && onZonesChange([...zones, next])
            }
            className="w-44"
          />
          <Button size="sm" variant="outline" render={<Link to="/schedule" />}>
            <PlusIcon />
            Schedule meeting
          </Button>
        </div>
      </KloqToolbar>
    </Kloq>
  );
};
