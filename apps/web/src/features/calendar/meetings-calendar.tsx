import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Kloq, KloqNav, KloqToolbar } from "@meetings/ui/kloq";
import { sampleMeetings } from "#/features/calendar/sample-meetings.ts";
import type { MeetingTime } from "#/features/meetings/find-a-time.tsx";
import { ZonePicker } from "#/features/meetings/zone-picker.tsx";
import { MINUTE, cityOf, formatOffset } from "#/lib/schedule.ts";

type MeetingsCalendarProps = {
  zone: string;
  zones: string[];
  onZonesChange: (zones: string[]) => void;
  onPlan: (time: MeetingTime) => void;
};

export const MeetingsCalendar = ({ zone, zones, onZonesChange, onPlan }: MeetingsCalendarProps) => {
  const events = useMemo(() => sampleMeetings(zone), [zone]);

  return (
    <Kloq
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
