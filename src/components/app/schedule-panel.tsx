import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { CalendarClockIcon, CalendarPlusIcon, UsersIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "#/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Toggle } from "#/components/ui/toggle";
import { ToggleGroup } from "#/components/ui/toggle-group";

// ponytail: fixed slots, add per-user availability when invitees' calendars exist.
const slots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "13:00",
  "13:30",
  "14:00",
  "15:30",
  "16:00",
];
const durations = [15, 30, 45, 60]; // must match DURATIONS in convex/meetings.ts

/** The local time `slot` ("HH:mm") on `day`, in ms. */
function slotStart(day: Date, slot: string) {
  const [h, m] = slot.split(":").map(Number);
  return new Date(day).setHours(h, m, 0, 0);
}

export function SchedulePanel({
  scheduling,
  onScheduling,
  onInvite,
}: {
  scheduling: boolean;
  onScheduling: (open: boolean) => void;
  onInvite: (meetingTitle: string) => void;
}) {
  const upcoming = useQuery(api.meetings.upcoming);
  const now = Date.now();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      {scheduling && <ScheduleCard onClose={() => onScheduling(false)} onInvite={onInvite} />}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-sm">Upcoming</h2>
        {upcoming?.length === 0 && (
          <Empty className="rounded-xl border border-dashed py-10 md:py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarPlusIcon />
              </EmptyMedia>
              <EmptyTitle className="text-base">No upcoming meetings</EmptyTitle>
              <EmptyDescription>
                Meetings you schedule or get invited to will show up here.
              </EmptyDescription>
            </EmptyHeader>
            {!scheduling && (
              <EmptyContent>
                <Button size="sm" variant="outline" onClick={() => onScheduling(true)}>
                  Schedule a meeting
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
        {upcoming?.map((m) => {
          const live = m.startsAt <= now;
          return (
            <div key={m._id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-sm">{m.title}</span>
                <span className="text-muted-foreground text-xs">
                  {format(m.startsAt, "EEE, MMM d · HH:mm")} · {m.durationMinutes} min
                </span>
              </div>
              {live && (
                <>
                  <Badge variant="error">Live</Badge>
                  <Button size="sm">Join</Button>
                </>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}

/** The scheduling form; mounted only while scheduling, so each open starts blank. */
function ScheduleCard({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (meetingTitle: string) => void;
}) {
  const today = new Date();
  const [date, setDate] = useState<Date>(today);
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const create = useMutation(api.meetings.create);

  async function schedule() {
    if (!time) return;
    setPending(true);
    setError(null);
    try {
      await create({ title, startsAt: slotStart(date, time), durationMinutes: duration });
      onClose();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Couldn't schedule the meeting.");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4" />
          Schedule a meeting
        </CardTitle>
        <CardDescription>Pick a day and a time, then invite people.</CardDescription>
      </CardHeader>
      <CardPanel className="@container flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-title">Title</Label>
          <Input
            id="meeting-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint review"
          />
        </div>
        <div className="flex flex-col gap-5 @xl:flex-row">
          <Calendar
            mode="single"
            selected={date}
            disabled={[{ before: today }]}
            onSelect={(d) => {
              if (d) {
                setDate(d);
                setTime(null);
              }
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="font-medium text-sm">{format(date, "EEEE, MMM d")}</p>
            <ToggleGroup
              className="grid w-full grid-cols-3 gap-1.5 @xl:grid-cols-2"
              value={time ? [time] : []}
              onValueChange={(v) => setTime(v[0] ?? null)}
            >
              {slots.map((slot) => (
                <Toggle
                  key={slot}
                  value={slot}
                  size="sm"
                  variant="outline"
                  disabled={slotStart(date, slot) < Date.now()}
                >
                  {slot}
                </Toggle>
              ))}
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <Label>Duration</Label>
              <ToggleGroup
                value={[String(duration)]}
                onValueChange={(v) => v[0] && setDuration(Number(v[0]))}
              >
                {durations.map((m) => (
                  <Toggle key={m} value={String(m)} size="sm" variant="outline">
                    {m}m
                  </Toggle>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
        {error && (
          <p className="text-destructive-foreground text-sm" role="alert">
            {error}
          </p>
        )}
      </CardPanel>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => onInvite(title)}>
          <UsersIcon />
          Invite people
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || !time || pending} onClick={() => void schedule()}>
            Schedule
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
