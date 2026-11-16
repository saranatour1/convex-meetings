import { useDeferredValue, useMemo } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  ClockIcon,
  EyeOffIcon,
  PlusIcon,
  RepeatIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { Switch } from "@meetings/ui/components/switch";
import { parseRRule } from "@meetings/ui/kloq/rrule";
import { RRuleBuilder } from "@meetings/ui/kloq/rrule-builder";
import {
  FindATime,
  type MeetingTime,
  type ScheduleDisplay,
} from "#/features/meetings/find-a-time.tsx";
import { sampleInvitees } from "#/features/meetings/sample-invitees.ts";
import {
  MINUTE,
  availability,
  clockShifts,
  dayOf,
  formatDate,
  formatOffset,
  formatTime,
  nextWorkday,
  repeatDays,
  wallMinutes,
  wallToUtc,
  type Share,
} from "#/lib/schedule.ts";

type ScheduleFormProps = {
  onInvite: (meetingTitle: string) => void;
  onClose: () => void;
  display: ScheduleDisplay;
  onDisplayChange: (display: ScheduleDisplay) => void;
  initialTime?: Partial<MeetingTime>;
};

export function ScheduleForm({
  onInvite,
  onClose,
  display,
  onDisplayChange,
  initialTime,
}: ScheduleFormProps) {
  const zone = display.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm({
    defaultValues: {
      title: "",
      rrule: undefined as string | undefined,
      isPrivate: false,
      day: initialTime?.start
        ? dayOf(initialTime.start, zone)
        : nextWorkday(dayOf(Date.now(), zone)),
      start: initialTime?.start ?? null,
      durationMinutes: initialTime?.minutes ?? 30,
      removed: [] as string[],
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const { day, durationMinutes, start, removed, rrule } = values;
  const planMinutes = useDeferredValue(durationMinutes);

  const invitees = useMemo(() => sampleInvitees(day, zone), [day, zone]);
  const { people, teams, everyone, plan } = useMemo(() => {
    const people = invitees.people.filter((p) => !removed.includes(p.id));
    const teams = invitees.teams.filter((t) => !removed.includes(t.id));
    const everyone = [invitees.organizer, ...people, ...teams.flatMap((t) => t.members)];
    return { people, teams, everyone, plan: availability(everyone, day, zone, planMinutes) };
  }, [invitees, removed, day, zone, planMinutes]);

  const chosen =
    start !== null && start >= plan.from && start < plan.to ? start : plan.best[0].start;
  const time = { start: chosen, minutes: durationMinutes };
  const rule = useMemo(() => (rrule ? parseRRule(rrule) : null), [rrule]);
  const shifts = useMemo(() => {
    if (!rule) return [];
    const minutes = wallMinutes(chosen, zone);
    return clockShifts(
      everyone,
      repeatDays(day, rule).map((d) => wallToUtc(d, minutes, zone)),
    );
  }, [rule, everyone, day, chosen, zone]);

  const others = everyone.filter((p) => p.id !== invitees.organizer.id);
  const sharing = (share: Share) => others.filter((p) => p.share === share).length;
  const notShared = sharing("none");
  const zoneCount = new Set(everyone.map((p) => formatOffset(chosen, p.timeZone))).size;
  const chips = [
    ...people.map((p) => ({
      id: p.id,
      name: p.name,
      initials: p.initials,
      detail: p.optional ? `${p.city} · optional` : p.city,
    })),
    ...teams.map((t) => ({
      id: t.id,
      name: t.name,
      initials: t.name.slice(0, 2).toUpperCase(),
      detail: `${t.members.length} people`,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4" />
          Schedule a meeting
        </CardTitle>
        <CardDescription>
          Pick a time that works across everyone's day, then invite them.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <form.Field name="title">
            {(field) => (
              <>
                <Label htmlFor="meeting-title" className="sr-only">
                  Title
                </Label>
                <Input
                  id="meeting-title"
                  autoFocus
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Meeting title"
                />
              </>
            )}
          </form.Field>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <RepeatIcon aria-hidden="true" className="size-4 opacity-80" />
              Repeats
            </span>
            <form.Field name="rrule">
              {(field) => (
                <RRuleBuilder
                  value={field.state.value}
                  date={new Date(chosen)}
                  onChange={field.handleChange}
                  className="w-64"
                />
              )}
            </form.Field>
            <form.Field name="isPrivate">
              {(field) => (
                <>
                  <Label className="ms-2 gap-2">
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                    Private
                  </Label>
                  <span className="text-muted-foreground text-sm">
                    {field.state.value
                      ? "People who can see your calendar see only “Busy”."
                      : "The title shows on calendars you share."}
                  </span>
                </>
              )}
            </form.Field>
          </div>
        </div>

        <section aria-labelledby="who-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 id="who-heading" className="font-semibold text-sm">
              Who
            </h3>
            <span className="text-muted-foreground text-sm">
              {everyone.length} people · {zoneCount} time zones
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              onClick={() => onInvite(form.state.values.title)}
            >
              <PlusIcon />
              Add people or teams
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2">
            <li className="flex h-9 items-center gap-2 rounded-full border ps-1 pe-3">
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-full bg-primary font-medium text-primary-foreground text-xs"
              >
                {invitees.organizer.initials}
              </span>
              <span className="font-medium text-sm">You</span>
              <span className="text-muted-foreground text-xs">
                Organizer · {invitees.organizer.city}
              </span>
            </li>
            {chips.map((chip) => (
              <li
                key={chip.id}
                className="flex h-9 items-center gap-2 rounded-full border ps-1 pe-0.5"
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 place-items-center rounded-full bg-muted font-medium text-xs"
                >
                  {chip.initials}
                </span>
                <span className="font-medium text-sm">{chip.name}</span>
                <span className="text-muted-foreground text-xs">{chip.detail}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Remove ${chip.name}`}
                  onClick={() => form.setFieldValue("removed", [...removed, chip.id])}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5">
              <CalendarCheckIcon aria-hidden="true" className="size-3.5" />
              {sharing("calendar")} share their calendar with you
            </span>
            <span className="flex items-center gap-1.5">
              <ClockIcon aria-hidden="true" className="size-3.5" />
              {sharing("hours")} share working hours only
            </span>
            <span className="flex items-center gap-1.5">
              <EyeOffIcon aria-hidden="true" className="size-3.5" />
              {notShared} {notShared === 1 ? "hasn't" : "haven't"} shared anything yet
            </span>
          </p>
        </section>

        <FindATime
          organizer={invitees.organizer}
          people={people}
          teams={teams}
          zone={zone}
          day={day}
          onDayChange={(next) => {
            form.setFieldValue("day", next);
            form.setFieldValue("start", null);
          }}
          plan={plan}
          time={time}
          onTimeChange={(next) => {
            form.setFieldValue("start", next.start);
            form.setFieldValue("durationMinutes", next.minutes);
          }}
          display={display}
          onDisplayChange={onDisplayChange}
        />

        {shifts.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/8 px-3 py-2.5 text-sm dark:bg-warning/16">
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-warning-foreground"
            />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Clocks change while this repeats</span>
              {shifts.slice(0, 2).map((shift) => (
                <span key={shift.start}>
                  <span className="font-medium">{formatDate(shift.start, zone)}:</span>{" "}
                  {shift.changes
                    .slice(0, 4)
                    .map((c) => `${c.person.name.split(" ")[0]} ${c.from} → ${c.to}`)
                    .join(", ")}
                  {shift.changes.length > 4 && `, and ${shift.changes.length - 4} more`}
                </span>
              ))}
              {shifts.length > 2 && (
                <span className="text-muted-foreground">
                  {shifts.length - 2} more clock changes in the next year. The time stays fixed for
                  you.
                </span>
              )}
            </div>
          </div>
        )}
      </CardPanel>
      <CardFooter className="flex flex-wrap items-center justify-end gap-2">
        <span className="me-auto text-muted-foreground text-sm tabular-nums">
          {formatDate(chosen, zone)} · {formatTime(chosen, zone)}–
          {formatTime(chosen + durationMinutes * MINUTE, zone)}
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <form.Subscribe selector={(state) => !state.values.title.trim()}>
          {(untitled) => <Button disabled={untitled}>Schedule</Button>}
        </form.Subscribe>
      </CardFooter>
    </Card>
  );
}
