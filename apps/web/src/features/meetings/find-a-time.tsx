import {
  Fragment,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChartGanttIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  InfoIcon,
  ListIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@meetings/ui/components/number-field";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@meetings/ui/components/popover";
import { Toggle } from "@meetings/ui/components/toggle";
import { ToggleGroup } from "@meetings/ui/components/toggle-group";
import { cn } from "@meetings/ui/lib/utils";
import { ZonePicker } from "#/features/meetings/zone-picker.tsx";
import {
  HOUR,
  MINUTE,
  addDays,
  cityOf,
  dayOf,
  formatDate,
  formatDuration,
  formatLongDate,
  formatOffset,
  formatTime,
  formatWeekday,
  nextClockChange,
  nextMidnight,
  snapTo,
  statusAt,
  wallToUtc,
  workingIntervals,
  type Day,
  type Person,
  type Plan,
  type Status,
  type StatusKind,
  type Team,
} from "#/lib/schedule.ts";

export type ScheduleDisplay = {
  view?: "list";
  zone?: string;
  zones?: string[];
  openTeam?: string;
};

export type MeetingTime = { start: number; minutes: number };

const STEP_MINUTES = 5;
const MIN_LENGTH = STEP_MINUTES * MINUTE;
const MAX_MINUTES = 8 * 60;

const tone: Record<StatusKind, { text: string; dot: string }> = {
  free: { text: "text-success-foreground", dot: "border-success bg-success" },
  busy: { text: "text-foreground", dot: "border-transparent bg-foreground/72" },
  stretch: { text: "text-warning-foreground", dot: "border-warning bg-warning" },
  out: { text: "text-muted-foreground", dot: "border-muted-foreground" },
};
const hatch =
  "bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]";
const shareLabel = { calendar: "Calendar", hours: "Working hours", none: "Nothing yet" };
const firstName = (p: Person) => p.name.split(" ")[0];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Drag = {
  mode: "draw" | "move" | "start" | "end";
  anchor: number;
  start: number;
  end: number;
  x: number;
  moved: boolean;
};

type FindATimeProps = {
  organizer: Person;
  people: Person[];
  teams: Team[];
  zone: string;
  day: Day;
  onDayChange: (day: Day) => void;
  plan: Plan;
  time: MeetingTime;
  onTimeChange: (time: MeetingTime) => void;
  display: ScheduleDisplay;
  onDisplayChange: (display: ScheduleDisplay) => void;
};

export function FindATime({
  organizer,
  people,
  teams,
  zone,
  day,
  onDayChange,
  plan,
  time,
  onTimeChange,
  display,
  onDisplayChange,
}: FindATimeProps) {
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const view = display.view ?? "timeline";
  const extraZones = (display.zones ?? []).filter((z) => z !== zone);

  const everyone = [organizer, ...people, ...teams.flatMap((t) => t.members)];
  const total = everyone.length;
  const start = time.start;
  const end = start + time.minutes * MINUTE;
  const range = `${formatTime(start, zone)}–${formatTime(end, zone)}`;
  const span = plan.to - plan.from;
  const frac = (t: number) => clamp((t - plan.from) / span, 0, 1);
  const place = (a: number, b: number) => ({
    left: `${frac(a) * 100}%`,
    width: `${(frac(b) - frac(a)) * 100}%`,
  });
  const max = Math.max(...plan.slots.map((s) => s.free));
  const slotIndex = plan.slots.findIndex((s) => start >= s.start && start < s.start + 30 * MINUTE);
  const statuses = new Map(everyone.map((p) => [p.id, statusAt(p, start, end)]));
  const status = (p: Person) => statuses.get(p.id) as Status;
  const notFree = everyone.filter((p) => status(p).kind !== "free");
  const nextChange = useMemo(() => nextClockChange(plan.from, zone), [plan.from, zone]);
  const zoneLabel = (z: string) => {
    const person = everyone.find((p) => p.timeZone === z);
    return z === zone
      ? `${organizer.city} (you)`
      : person
        ? `${person.city} (${firstName(person)})`
        : cityOf(z);
  };

  const teamCells = useMemo(
    () =>
      new Map(
        teams.map((t) => [
          t.id,
          plan.slots.map(
            (s) =>
              t.members.filter((m) => statusAt(m, s.start, s.start + 30 * MINUTE).kind === "free")
                .length,
          ),
        ]),
      ),
    [teams, plan],
  );

  const ticks: number[] = [];
  for (let t = plan.from; t < plan.to; t += HOUR) ticks.push(t);
  const columns = { gridTemplateColumns: `repeat(${plan.slots.length}, minmax(0, 1fr))` };

  const commit = (from: number, to: number) =>
    onTimeChange({ start: from, minutes: Math.round((to - from) / MINUTE) });

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return start;
    return snapTo(plan.from + clamp((clientX - rect.left) / rect.width, 0, 1) * span, STEP_MINUTES);
  };

  const beginDrag = (mode: Drag["mode"]) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode,
      anchor: timeAt(event.clientX),
      start,
      end,
      x: event.clientX,
      moved: false,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    event.stopPropagation();
    if (!d || (!d.moved && Math.abs(event.clientX - d.x) < 3)) return;
    d.moved = true;
    const t = timeAt(event.clientX);
    const length = d.end - d.start;
    if (d.mode === "move") {
      const from = clamp(d.start + t - d.anchor, plan.from, plan.to - length);
      commit(from, from + length);
    } else if (d.mode === "start") {
      commit(clamp(t, d.end - MAX_MINUTES * MINUTE, d.end - MIN_LENGTH), d.end);
    } else if (d.mode === "end") {
      commit(d.start, clamp(t, d.start + MIN_LENGTH, d.start + MAX_MINUTES * MINUTE));
    } else {
      const from = Math.min(d.anchor, t);
      commit(from, Math.max(Math.max(d.anchor, t), from + MIN_LENGTH));
    }
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.mode === "draw") {
      const length = d.end - d.start;
      const from = clamp(d.anchor, plan.from, plan.to - length);
      commit(from, from + length);
    }
  };

  const dragHandlers = (mode: Drag["mode"]) => ({
    onPointerDown: beginDrag(mode),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  });

  const onLensKey = (event: KeyboardEvent) => {
    const step = (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0) * MIN_LENGTH;
    if (!step) return;
    event.preventDefault();
    if (event.shiftKey) {
      commit(start, clamp(end + step, start + MIN_LENGTH, start + MAX_MINUTES * MINUTE));
    } else {
      const from = clamp(start + step, plan.from, plan.to - (end - start));
      commit(from, from + (end - start));
    }
  };

  const onSlotKey = (event: KeyboardEvent) => {
    const last = plan.slots.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: slotIndex + 1,
      ArrowLeft: slotIndex - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const i = clamp(moves[event.key], 0, last);
    onTimeChange({ start: plan.slots[i].start, minutes: time.minutes });
    slotRefs.current[i]?.focus({ preventScroll: true });
  };

  const statusLine = (p: Person) => {
    const s = status(p);
    return (
      <span className={cn("flex items-center gap-1.5 text-xs", tone[s.kind].text)}>
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full border-[1.5px]", tone[s.kind].dot)}
        />
        {s.label}
      </span>
    );
  };

  const personRow = (p: Person, nested = false) => {
    const hours = workingIntervals(p, plan.from, plan.to);
    const busy =
      p.share === "calendar" ? p.busy.filter((b) => b.end > plan.from && b.start < plan.to) : [];
    const midnight = nextMidnight(p, plan.from);
    const tag = p.id === organizer.id ? "Organizer" : p.optional ? "Optional" : null;
    return (
      <div key={p.id} className="flex min-h-16 border-b">
        <div
          className={cn("flex w-68 shrink-0 items-start gap-2.5 py-2.5 pe-3", nested && "ps-10")}
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-medium text-xs"
          >
            {p.initials}
          </span>
          <div className="flex min-w-0 flex-col gap-px">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-sm">{p.name}</span>
              {tag && <Badge variant="secondary">{tag}</Badge>}
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {p.city} ·{" "}
              <span className="font-medium text-foreground">{formatTime(start, p.timeZone)}</span>{" "}
              {formatWeekday(start, p.timeZone)}
            </span>
            {statusLine(p)}
            {p.zoneConflict && <ZoneCheck person={p} at={start} zone={zone} />}
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-1 flex-col justify-center gap-1 py-1.5">
          <div
            className={cn(
              "relative h-7 rounded-md shadow-[inset_0_0_0_1px_var(--color-border)]",
              hatch,
            )}
          >
            {hours.map((h) => (
              <span
                key={h.start}
                className={cn(
                  "absolute inset-y-0 rounded-md bg-success/16",
                  p.share !== "calendar" && "border border-success-foreground border-dashed",
                )}
                style={place(h.start, h.end)}
              />
            ))}
            {busy.map((b) => (
              <span
                key={b.start}
                className="absolute inset-y-1 overflow-hidden whitespace-nowrap rounded bg-foreground/72 ps-1.5 text-[11px] text-background leading-5"
                style={place(b.start, b.end)}
              >
                Busy
              </span>
            ))}
            {midnight > plan.from && midnight < plan.to && (
              <>
                <span
                  className="absolute -inset-y-1 border-foreground border-s-[1.5px] border-dashed"
                  style={{ left: `${frac(midnight) * 100}%` }}
                />
                <span
                  className="absolute -top-px ms-1 rounded-sm bg-background px-0.5 font-semibold text-[11px] leading-3.5"
                  style={{ left: `${frac(midnight) * 100}%` }}
                >
                  {formatWeekday(midnight, p.timeZone)}
                </span>
              </>
            )}
          </div>
          <div className="relative h-3.5">
            {[0, 3, 6, 9].map((k) => (
              <span
                key={k}
                className="absolute top-0 ps-1 text-[11px] text-muted-foreground tabular-nums leading-3.5"
                style={{ left: `${frac(plan.from + k * HOUR) * 100}%` }}
              >
                {formatTime(plan.from + k * HOUR, p.timeZone)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const teamRow = (t: Team) => {
    const isOpen = display.openTeam === t.id;
    const cells = teamCells.get(t.id) ?? [];
    const freeNow = t.members.filter((m) => status(m).kind === "free").length;
    return (
      <Fragment key={t.id}>
        <div className="flex min-h-16 border-b bg-muted/40">
          <div className="flex w-68 shrink-0 items-start gap-2.5 py-2.5 pe-3">
            <Button
              size="icon-sm"
              variant="outline"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Hide" : "Show"} the people in ${t.name}`}
              onClick={() => onDisplayChange({ openTeam: isOpen ? undefined : t.id })}
            >
              <ChevronDownIcon className={cn("transition-transform", !isOpen && "-rotate-90")} />
            </Button>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="font-medium text-sm">
                {t.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {t.members.length} people
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                {[...new Set(t.members.map((m) => m.city))].join(", ")}
              </span>
              <span className="text-xs tabular-nums">
                {freeNow} of {t.members.length} free at {formatTime(start, zone)}
              </span>
            </div>
          </div>
          <div aria-hidden="true" className="flex flex-1 flex-col justify-center gap-1 py-1.5">
            <div className="grid h-7 overflow-hidden rounded-md" style={columns}>
              {cells.map((n, i) => (
                <span
                  key={plan.slots[i].start}
                  className="grid place-items-center border-background border-e text-[11px] tabular-nums"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--success) ${Math.round(4 + (32 * n) / t.members.length)}%, transparent)`,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground leading-3.5">
              Free per half hour, out of {t.members.length}
            </span>
          </div>
        </div>
        {isOpen && t.members.map((m) => personRow(m, true))}
      </Fragment>
    );
  };

  return (
    <section aria-labelledby="when-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="when-heading" className="me-1 font-semibold text-sm">
          When
        </h3>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous day"
            disabled={day <= dayOf(Date.now(), zone)}
            onClick={() => onDayChange(addDays(day, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-24 text-center font-medium text-sm">
            {formatDate(wallToUtc(day, 12 * 60, zone), zone)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next day"
            onClick={() => onDayChange(addDays(day, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <NumberField
          value={time.minutes}
          min={STEP_MINUTES}
          max={MAX_MINUTES}
          step={STEP_MINUTES}
          onValueChange={(minutes) =>
            minutes &&
            onTimeChange({
              start,
              minutes: clamp(Math.round(minutes / STEP_MINUTES) * STEP_MINUTES, 5, MAX_MINUTES),
            })
          }
          className="w-auto flex-row items-center gap-2"
        >
          <span className="text-muted-foreground text-sm">Length</span>
          <NumberFieldGroup>
            <NumberFieldDecrement aria-label="5 minutes shorter" />
            <NumberFieldInput aria-label="Length in minutes" className="w-12 text-center" />
            <NumberFieldIncrement aria-label="5 minutes longer" />
          </NumberFieldGroup>
          <span className="text-muted-foreground text-sm">min</span>
        </NumberField>
        <ToggleGroup
          aria-label="View"
          className="ms-auto"
          variant="outline"
          size="sm"
          value={[view]}
          onValueChange={(values) =>
            values[0] && onDisplayChange({ view: values[0] === "list" ? "list" : undefined })
          }
        >
          <Toggle value="timeline">
            <ChartGanttIcon />
            Timeline
          </Toggle>
          <Toggle value="list">
            <ListIcon />
            List
          </Toggle>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GlobeIcon aria-hidden="true" className="size-4 text-muted-foreground opacity-80" />
        <span className="text-muted-foreground text-sm">Your time zone</span>
        <ZonePicker
          label="Your time zone"
          placeholder="Search time zones"
          value={zone}
          onChange={(next) => onDisplayChange({ zone: next })}
          className="w-52"
        />
        <span className="ms-2 text-muted-foreground text-sm">Also show</span>
        {extraZones.map((z) => (
          <span
            key={z}
            className="flex h-7 items-center gap-1 rounded-full border ps-2.5 pe-0.5 text-sm"
          >
            {zoneLabel(z)}
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatOffset(start, z)}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              className="rounded-full"
              aria-label={`Stop showing ${zoneLabel(z)}`}
              onClick={() => onDisplayChange({ zones: extraZones.filter((x) => x !== z) })}
            >
              <XIcon />
            </Button>
          </span>
        ))}
        <ZonePicker
          label="Add a time zone"
          placeholder="Add a time zone"
          onChange={(next) =>
            next !== zone &&
            !extraZones.includes(next) &&
            onDisplayChange({ zones: [...extraZones, next] })
          }
          className="w-44"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="me-1 text-muted-foreground text-sm">Best times</span>
        {plan.best.slice(0, 3).map((s) => (
          <Toggle
            key={s.start}
            variant="outline"
            size="sm"
            className="rounded-full px-3 tabular-nums"
            pressed={s.start === start}
            onPressedChange={() => onTimeChange({ start: s.start, minutes: time.minutes })}
          >
            {formatTime(s.start, zone)}
            <span className="font-normal text-muted-foreground">
              {s.free} of {total} free
            </span>
          </Toggle>
        ))}
      </div>

      <p
        aria-live="polite"
        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm"
      >
        <InfoIcon aria-hidden="true" className="size-4 shrink-0 opacity-80" />
        <span className="min-w-0 truncate">
          <strong className="font-semibold">
            {total - notFree.length} of {total} free at {range}.
          </strong>{" "}
          {notFree.length === 0
            ? "Everyone is free."
            : `${notFree
                .map((p) => {
                  const s = status(p);
                  const who = `${firstName(p)}${p.optional ? " (optional)" : ""}`;
                  const local =
                    s.kind === "out" ? `, ${formatTime(start, p.timeZone)} for them` : "";
                  return `${who}: ${s.label.toLowerCase()}${local}`;
                })
                .join(". ")}.`}
        </span>
      </p>

      {view === "timeline" ? (
        <>
          <div className="-mx-6 overflow-x-auto overscroll-x-contain px-6 pt-7 pb-1">
            <div className="min-w-260">
              {[zone, ...extraZones].map((z) => (
                <div key={z} aria-hidden="true" className="flex h-5">
                  <div className="w-68 shrink-0 truncate pe-3 text-muted-foreground text-xs">
                    {zoneLabel(z)} · {formatOffset(start, z)}
                  </div>
                  <div className="relative flex-1">
                    {ticks.map((t) => (
                      <span
                        key={t}
                        className="absolute top-0 h-5 border-s ps-1 text-[11px] text-muted-foreground tabular-nums leading-3.5"
                        style={{ left: `${frac(t) * 100}%` }}
                      >
                        {formatTime(t, z)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="relative">
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Meeting time. Left and right arrows move it, Shift with arrows changes the length."
                  aria-valuemin={0}
                  aria-valuemax={Math.round(span / MINUTE)}
                  aria-valuenow={Math.round((start - plan.from) / MINUTE)}
                  aria-valuetext={`${range}, ${formatDuration(end - start)}`}
                  onKeyDown={onLensKey}
                  {...dragHandlers("move")}
                  className="group absolute -inset-y-1 z-20 cursor-grab touch-none rounded-lg border-2 border-foreground outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{
                    left: `calc(17rem + (100% - 17rem) * ${frac(start)})`,
                    width: `calc((100% - 17rem) * ${frac(end) - frac(start)})`,
                  }}
                >
                  <span className="pointer-events-none absolute -top-6.5 -start-0.5 whitespace-nowrap rounded-sm bg-foreground px-1.5 py-0.5 font-medium text-background text-xs tabular-nums">
                    {range} · {formatDuration(end - start)}
                  </span>
                  <span
                    aria-hidden="true"
                    {...dragHandlers("start")}
                    className="absolute inset-y-0 -start-2 flex w-4 cursor-ew-resize items-center justify-center"
                  >
                    <span className="h-8 w-1.5 rounded-full bg-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </span>
                  <span
                    aria-hidden="true"
                    {...dragHandlers("end")}
                    className="absolute inset-y-0 -end-2 flex w-4 cursor-ew-resize items-center justify-center"
                  >
                    <span className="h-8 w-1.5 rounded-full bg-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </span>
                </div>
                <div className="flex border-b">
                  <div className="flex w-68 shrink-0 flex-col justify-end py-2 pe-3">
                    <span className="font-medium text-sm">Everyone</span>
                    <span className="text-muted-foreground text-xs">
                      Free per half hour, out of {total}. Drag on the rows to pick a time.
                    </span>
                  </div>
                  <div
                    role="group"
                    aria-label="Start time"
                    onKeyDown={onSlotKey}
                    className="grid h-18 flex-1 items-end"
                    style={columns}
                  >
                    {plan.slots.map((s, i) => {
                      const on = i === slotIndex;
                      return (
                        <button
                          key={s.start}
                          ref={(el) => {
                            slotRefs.current[i] = el;
                          }}
                          type="button"
                          tabIndex={on || (slotIndex < 0 && i === 0) ? 0 : -1}
                          aria-pressed={on}
                          aria-label={`${formatTime(s.start, zone)}, ${s.free} of ${total} free${s.free === max ? ", one of the best times" : ""}`}
                          onClick={() => onTimeChange({ start: s.start, minutes: time.minutes })}
                          className="flex h-18 flex-col items-center justify-end gap-0.5 rounded-md px-0.5 pt-1.5 pb-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "block w-full max-w-5 rounded-[3px] transition-[height] duration-150",
                              on
                                ? "bg-foreground"
                                : s.free === max
                                  ? "bg-foreground/36"
                                  : "bg-foreground/12",
                            )}
                            style={{
                              height: Math.max(3, Math.round((s.free / Math.max(total, 1)) * 44)),
                            }}
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "text-[11px] tabular-nums leading-3.5",
                              on ? "font-semibold text-foreground" : "text-muted-foreground",
                              s.free === max && "font-semibold",
                            )}
                          >
                            {s.free}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="relative">
                  <div
                    ref={trackRef}
                    aria-hidden="true"
                    {...dragHandlers("draw")}
                    className="absolute inset-y-0 start-68 end-0 z-10 cursor-crosshair"
                  />
                  {[organizer, ...people].map((p) => personRow(p))}
                  {teams.map(teamRow)}
                </div>
              </div>
            </div>
          </div>
          <ul
            aria-label="Legend"
            className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-xs"
          >
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-5 rounded-[3px] bg-success/16" />
              Working hours
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "h-3 w-5 rounded-[3px] shadow-[inset_0_0_0_1px_var(--color-border)]",
                  hatch,
                )}
              />
              Outside working hours
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-5 rounded-[3px] bg-foreground/72" />
              Busy, from a shared calendar
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 w-5 rounded-[3px] border border-success-foreground border-dashed bg-success/16"
              />
              Working hours only, calendar not shared
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 border-foreground border-s-[1.5px] border-dashed"
              />
              Their date changes
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">
            Your time zone is {zone}, {formatOffset(start, zone)}.{" "}
            {nextChange
              ? `Clocks there next change on ${formatLongDate(nextChange, zone)}.`
              : "No daylight saving there."}
          </p>
        </>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-190">
            <h4 className="mb-2 font-medium text-sm">Everyone at {range}</h4>
            <div
              aria-hidden="true"
              className="grid grid-cols-[2fr_1.1fr_2.2fr_2.2fr_1.3fr] gap-3 border-b py-2 font-medium text-muted-foreground text-xs"
            >
              <span>Person</span>
              <span>Their time</span>
              <span>Time zone</span>
              <span>Status</span>
              <span>Shares</span>
            </div>
            <ul>
              {everyone.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[2fr_1.1fr_2.2fr_2.2fr_1.3fr] items-center gap-3 border-b py-2.5 text-sm"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums">
                    <span className="sr-only">Their time: </span>
                    {formatTime(start, p.timeZone)} {formatWeekday(start, p.timeZone)}
                  </span>
                  <span>
                    <span className="font-mono text-[13px]">{p.timeZone}</span>{" "}
                    <span className="text-muted-foreground">{formatOffset(start, p.timeZone)}</span>
                  </span>
                  {statusLine(p)}
                  <span className="text-muted-foreground">
                    <span className="sr-only">Shares: </span>
                    {shareLabel[p.share]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function ZoneCheck({ person, at, zone }: { person: Person; at: number; zone: string }) {
  const conflict = person.zoneConflict;
  if (!conflict) return null;
  const name = firstName(person);
  return (
    <Popover>
      <PopoverTrigger className="w-fit text-start font-medium text-warning-foreground text-xs underline-offset-2 hover:underline">
        Time zone not confirmed
      </PopoverTrigger>
      <PopoverPopup className="w-80">
        <div className="flex flex-col gap-2">
          <PopoverTitle className="text-sm">
            Is {name} in {person.city}?
          </PopoverTitle>
          <PopoverDescription>
            The profile says <span className="font-mono">{person.timeZone}</span>, but recent
            sign-ins came from {conflict.city}. If {name} is there, your {formatTime(at, zone)} is{" "}
            {formatTime(at, conflict.timeZone)} for them, not {formatTime(at, person.timeZone)}.
          </PopoverDescription>
          <Button size="sm" variant="outline" className="self-start">
            Ask {name}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
