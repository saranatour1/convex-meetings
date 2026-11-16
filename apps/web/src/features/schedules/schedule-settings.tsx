import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { GlobeIcon, XIcon } from "lucide-react";
import { api, type Doc } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Checkbox } from "@meetings/ui/components/checkbox";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { ZonePicker } from "#/features/meetings/zone-picker.tsx";
import { describeError } from "#/lib/errors.ts";
import { browserTimeZone } from "#/lib/browser.ts";
import { cityOf, formatOffset } from "#/lib/schedule.ts";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_EXTRA_ZONES = 5;

type Day = { enabled: boolean; start: string; end: string };

const toDays = (schedule: Doc<"schedules"> | null): Day[] =>
  WEEKDAYS.map((_, i) => {
    const hours = schedule?.weeklyHours.find((h) => h.weekday === i + 1);
    if (hours) return { enabled: true, start: hours.start, end: hours.end };
    return { enabled: !schedule && i < 5, start: "09:00", end: "17:00" };
  });

const ScheduleSettingsForm = ({ schedule }: { schedule: Doc<"schedules"> | null }) => {
  const save = useMutation(api.schedules.setMine);
  const reportTimeZone = useMutation(api.users.reportTimeZone);
  const form = useForm({
    defaultValues: {
      timeZone: schedule?.timeZone ?? browserTimeZone(),
      days: toDays(schedule),
      alsoShow: schedule?.alsoShow ?? [],
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await save({
            timeZone: value.timeZone,
            weeklyHours: value.days.flatMap((day, i) =>
              day.enabled ? [{ weekday: i + 1, start: day.start, end: day.end }] : [],
            ),
            alsoShow: value.alsoShow.filter((zone) => zone !== value.timeZone),
          });
          await reportTimeZone({ timeZone: browserTimeZone() });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4" />
            Time zone and working hours
          </CardTitle>
          <CardDescription>
            People in your organization see these when they look for a time to meet you.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-6">
          <form.Field name="timeZone">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>Your time zone</Label>
                <ZonePicker
                  value={field.state.value}
                  onChange={field.handleChange}
                  label="Your time zone"
                  placeholder="Search cities or zones"
                  className="max-w-sm"
                />
                <span className="text-muted-foreground text-xs">
                  {cityOf(field.state.value)} is {formatOffset(Date.now(), field.state.value)} now.
                  Your browser says {cityOf(browserTimeZone())}.
                </span>
              </div>
            )}
          </form.Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-sm">Working hours</legend>
            {WEEKDAYS.map((weekday, i) => (
              <div key={weekday} className="flex flex-wrap items-center gap-3">
                <form.Field name={`days[${i}].enabled`}>
                  {(field) => (
                    <Label className="w-32 gap-2">
                      <Checkbox
                        checked={field.state.value}
                        onCheckedChange={(checked) => field.handleChange(checked === true)}
                      />
                      {weekday}
                    </Label>
                  )}
                </form.Field>
                <form.Subscribe selector={(state) => state.values.days[i]?.enabled}>
                  {(enabled) =>
                    enabled ? (
                      <div className="flex items-center gap-2">
                        <form.Field name={`days[${i}].start`}>
                          {(field) => (
                            <Input
                              type="time"
                              aria-label={`${weekday} start`}
                              className="w-32"
                              value={field.state.value}
                              onChange={(event) => field.handleChange(event.target.value)}
                            />
                          )}
                        </form.Field>
                        <span className="text-muted-foreground text-sm">to</span>
                        <form.Field name={`days[${i}].end`}>
                          {(field) => (
                            <Input
                              type="time"
                              aria-label={`${weekday} end`}
                              className="w-32"
                              value={field.state.value}
                              onChange={(event) => field.handleChange(event.target.value)}
                            />
                          )}
                        </form.Field>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not working</span>
                    )
                  }
                </form.Subscribe>
              </div>
            ))}
          </fieldset>

          <form.Field name="alsoShow">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label>Other time zones you work with</Label>
                <span className="text-muted-foreground text-xs">
                  They show next to yours on Find a time and the calendar.
                </span>
                <ul className="flex flex-wrap gap-2">
                  {field.state.value.map((zone) => (
                    <li
                      key={zone}
                      className="flex h-8 items-center gap-1.5 rounded-full border ps-3 pe-0.5 text-sm"
                    >
                      {cityOf(zone)}
                      <span className="text-muted-foreground text-xs">
                        {formatOffset(Date.now(), zone)}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Stop showing ${cityOf(zone)}`}
                        onClick={() =>
                          field.handleChange(field.state.value.filter((z) => z !== zone))
                        }
                      >
                        <XIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
                {field.state.value.length < MAX_EXTRA_ZONES && (
                  <ZonePicker
                    onChange={(zone) =>
                      field.handleChange([...new Set([...field.state.value, zone])])
                    }
                    label="Add a time zone"
                    placeholder="Add a city or zone"
                    className="max-w-sm"
                  />
                )}
              </div>
            )}
          </form.Field>
        </CardPanel>
        <CardFooter className="flex items-center justify-end gap-3">
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => (
              <span className="me-auto">
                <FormError error={error} />
              </span>
            )}
          </form.Subscribe>
          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.isSubmitSuccessful, state.isDirty]}
          >
            {([isSubmitting, saved, dirty]) => (
              <>
                {saved && !dirty && <span className="text-muted-foreground text-sm">Saved</span>}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
};

export const ScheduleSettings = () => {
  const schedule = useQuery(api.schedules.getMine);
  if (schedule === undefined) return <LoadingScreen />;
  return <ScheduleSettingsForm schedule={schedule} />;
};
