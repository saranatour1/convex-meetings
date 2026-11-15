import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { CalendarClockIcon, UsersIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import { Calendar } from "@meetings/ui/components/calendar";
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
import { Toggle } from "@meetings/ui/components/toggle";
import { ToggleGroup } from "@meetings/ui/components/toggle-group";

const TIME_SLOTS = [
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
const DURATIONS_IN_MINUTES = [15, 30, 45, 60];

type ScheduleFormProps = {
  onInvite: (meetingTitle: string) => void;
  onClose: () => void;
};

export function ScheduleForm({ onInvite, onClose }: ScheduleFormProps) {
  const today = new Date();
  const form = useForm({
    defaultValues: { title: "", date: today, time: "", durationMinutes: 30 },
  });

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
        <form.Field name="title">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="meeting-title">Title</Label>
              <Input
                id="meeting-title"
                autoFocus
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="e.g. Sprint review"
              />
            </div>
          )}
        </form.Field>
        <div className="flex flex-col gap-5 @xl:flex-row">
          <form.Field name="date">
            {(field) => (
              <Calendar
                mode="single"
                selected={field.state.value}
                disabled={[{ before: today }]}
                onSelect={(day) => {
                  if (!day) return;
                  field.handleChange(day);
                  form.setFieldValue("time", "");
                }}
              />
            )}
          </form.Field>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <form.Subscribe selector={(state) => state.values.date}>
              {(date) => <p className="font-medium text-sm">{format(date, "EEEE, MMM d")}</p>}
            </form.Subscribe>
            <form.Field name="time">
              {(field) => (
                <ToggleGroup
                  className="grid w-full grid-cols-3 gap-1.5 @xl:grid-cols-2"
                  value={field.state.value ? [field.state.value] : []}
                  onValueChange={(values) => field.handleChange(values[0] ?? "")}
                >
                  {TIME_SLOTS.map((slot) => (
                    <Toggle key={slot} value={slot} size="sm" variant="outline">
                      {slot}
                    </Toggle>
                  ))}
                </ToggleGroup>
              )}
            </form.Field>
            <form.Field name="durationMinutes">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label>Duration</Label>
                  <ToggleGroup
                    value={[String(field.state.value)]}
                    onValueChange={(values) => values[0] && field.handleChange(Number(values[0]))}
                  >
                    {DURATIONS_IN_MINUTES.map((minutes) => (
                      <Toggle key={minutes} value={String(minutes)} size="sm" variant="outline">
                        {minutes}m
                      </Toggle>
                    ))}
                  </ToggleGroup>
                </div>
              )}
            </form.Field>
          </div>
        </div>
      </CardPanel>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => onInvite(form.state.values.title)}>
          <UsersIcon />
          Invite people
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => !state.values.title.trim() || !state.values.time}>
            {(incomplete) => <Button disabled={incomplete}>Schedule</Button>}
          </form.Subscribe>
        </div>
      </CardFooter>
    </Card>
  );
}
