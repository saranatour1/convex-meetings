import { useMemo } from "react";
import { track } from "@databuddy/sdk";
import {
  optimisticallyUpdateValueInPaginatedQuery,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@meetings/backend";
import { EyeIcon, EyeOffIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import {
  Kloq,
  KloqNav,
  KloqToolbar,
  formatInstant,
  parseInstant,
  type Attendee,
  type CalEvent,
  type KloqChange,
} from "@meetings/ui/kloq";
import type { MeetingTime } from "#/features/meetings/find-a-time.tsx";
import { meetingLink } from "#/features/meetings/meeting-access.tsx";
import { kindOf } from "#/features/meetings/meeting-kinds.ts";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { ZonePicker } from "#/features/meetings/zone-picker.tsx";
import { showError } from "#/lib/errors.ts";
import { MINUTE, cityOf, formatOffset } from "#/lib/schedule.ts";

type MeetingsCalendarProps = {
  zone: string;
  zones: string[];
  onZonesChange: (zones: string[]) => void;
  onPlan: (time?: MeetingTime) => void;
  selected?: string;
  onSelect: (code: string | undefined) => void;
  showDeclined: boolean;
  onShowDeclinedChange: (show: boolean) => void;
};

type Person = {
  _id: string;
  email: string | null;
  name: string;
  role: "host" | "participant";
  response: "pending" | "accepted" | "declined";
};

const toAttendee = (p: Person): Attendee => ({
  email: p.email ?? p._id,
  name: p.name,
  status: p.response,
});

const fail = (error: unknown): never => {
  showError(error);
  throw error;
};

const timeOf = (start: number, end: number): MeetingTime => ({
  start,
  minutes: Math.round((end - start) / MINUTE),
});

export const MeetingsCalendar = ({
  zone,
  zones,
  onZonesChange,
  onPlan,
  selected,
  onSelect,
  showDeclined,
  onShowDeclinedChange,
}: MeetingsCalendarProps) => {
  const meetings = usePaginatedQuery(api.meetings.mine, {}, { initialNumItems: 200 });
  const viewer = useQuery(api.users.viewer);
  const detail = useQuery(api.meetings.get, selected ? { code: selected } : "skip");
  const { orgId } = useActiveOrg();
  const settings = useQuery(api.settings.getMine);
  const create = useMutation(api.meetings.create);
  const rename = useMutation(api.meetings.rename).withOptimisticUpdate(
    (store, { meetingId, title }) =>
      optimisticallyUpdateValueInPaginatedQuery(store, api.meetings.mine, {}, (m) =>
        m._id === meetingId ? { ...m, title } : m,
      ),
  );
  const reschedule = useMutation(api.meetings.reschedule).withOptimisticUpdate(
    (store, { meetingId, startsAt, minutes }) =>
      optimisticallyUpdateValueInPaginatedQuery(store, api.meetings.mine, {}, (m) =>
        m._id === meetingId ? { ...m, startsAt, endsAt: startsAt + minutes * MINUTE } : m,
      ),
  );
  const me = viewer?.email ?? undefined;
  const events = useMemo(
    () =>
      meetings.results.map((m): CalEvent => {
        const people = detail?.code === m.code ? detail.people : null;
        const host = people?.find((p) => p.role === "host");
        return {
          id: m.code,
          title: m.title,
          color: kindOf(m.kind).color,
          rrule: m.rrule ?? undefined,
          start: formatInstant(new Date(m.startsAt), m.timeZone),
          end: formatInstant(new Date(m.endsAt), m.timeZone),
          timeZone: m.timeZone,
          meetingUrl: meetingLink(m.code),
          readOnly: m.role !== "host" || m.rrule !== null || m.endedAt !== null,
          busy: m.response !== "pending",
          organizer: host ? toAttendee(host).email : m.role === "host" ? me : undefined,
          attendees: people
            ? people.map(toAttendee)
            : me
              ? [{ email: me, name: viewer?.name, status: m.response }]
              : undefined,
        };
      }),
    [meetings.results, detail, me, viewer?.name],
  );
  const commit = async (change: KloqChange): Promise<void> => {
    if (change.type === "batch") {
      await Promise.all(change.changes.map(commit));
      return;
    }
    if (change.type === "add") {
      if (change.event.allDay) return;
      const time = timeOf(parseInstant(change.event.start), parseInstant(change.event.end));
      if (!settings) return onPlan(time);
      const { code } = await create({
        orgId,
        title: change.event.title.trim() || "New meeting",
        kind: settings.defaultKind,
        recap: settings.defaultRecap,
        startsAt: time.start,
        minutes: time.minutes,
        timeZone: zone,
        inviteeIds: [],
      }).catch(fail);
      track("meeting_scheduled", { kind: settings.defaultKind, repeats: false });
      onSelect(code);
      return;
    }
    if (change.type !== "update" || change.patch.allDay) return;
    const meeting = meetings.results.find((m) => m.code === change.id);
    if (!meeting) return;
    const title = change.patch.title?.trim();
    if (title) await rename({ meetingId: meeting._id, title }).catch(fail);
    if (!change.patch.start && !change.patch.end) return;
    const time = timeOf(
      parseInstant(change.patch.start ?? change.prev.start),
      parseInstant(change.patch.end ?? change.prev.end),
    );
    await reschedule({ meetingId: meeting._id, startsAt: time.start, minutes: time.minutes }).catch(
      fail,
    );
  };

  return (
    <Kloq
      className="overflow-hidden rounded-2xl border"
      events={events}
      currentUserEmail={me}
      showDeclinedEvents={showDeclined}
      onSelectionChange={(chosen) => onSelect(chosen[0]?.id)}
      persistence={false}
      storage={false}
      designMode={false}
      displayTimeZone={zone}
      timeZones={zones}
      onSlotClick={(slot) =>
        !slot.allDay && onPlan(timeOf(slot.start.getTime(), slot.end.getTime()))
      }
      onCommit={commit}
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
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showDeclined}
            onClick={() => onShowDeclinedChange(!showDeclined)}
          >
            {showDeclined ? <EyeIcon /> : <EyeOffIcon />}
            {showDeclined ? "Showing declined" : "Declined hidden"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPlan()}>
            <PlusIcon />
            Schedule meeting
          </Button>
        </div>
      </KloqToolbar>
    </Kloq>
  );
};
