import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@meetings/ui/components/dialog";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { Textarea } from "@meetings/ui/components/textarea";
import { FormError } from "#/components/form-error.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { MINUTE, cityOf, dayOf, formatTime, wallToUtc } from "#/lib/schedule.ts";
import type { MeetingDetails } from "./meeting-people.tsx";

const clockMinutes = (clock: string) => {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  return hours * 60 + minutes;
};

const EditMeetingForm = ({ meeting, onDone }: { meeting: MeetingDetails; onDone: () => void }) => {
  const edit = useMutation(api.meetings.edit);
  const reschedule = useMutation(api.meetings.reschedule);
  const zone = browserTimeZone();
  const time = meeting.time && !meeting.time.rrule && !meeting.endedAt ? meeting.time : null;
  const form = useForm({
    defaultValues: {
      title: meeting.title,
      description: meeting.description ?? "",
      location: meeting.location ?? "",
      day: time ? dayOf(time.startsAt, zone) : "",
      start: time ? formatTime(time.startsAt, zone) : "",
      minutes: time ? Math.round((time.endsAt - time.startsAt) / MINUTE) : 0,
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await edit({
            meetingId: meeting._id,
            title: value.title,
            description: value.description,
            location: value.location,
          });
          if (time) {
            const startsAt = wallToUtc(value.day, clockMinutes(value.start), zone);
            const moved = startsAt !== time.startsAt;
            if (moved || value.minutes * MINUTE !== time.endsAt - time.startsAt) {
              await reschedule({ meetingId: meeting._id, startsAt, minutes: value.minutes });
            }
          }
          onDone();
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit meeting</DialogTitle>
        <DialogDescription>
          {time
            ? "Moving it tells everyone invited and asks them to reply again."
            : meeting.time?.rrule && !meeting.endedAt
              ? "The time of a repeating meeting can't be changed yet."
              : "Change what people see about this meeting."}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        <form.Field name="title">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-meeting-title">Title</Label>
              <Input
                id="edit-meeting-title"
                autoFocus
                required
                maxLength={200}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        {time && (
          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <form.Field name="day">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-meeting-day">Date</Label>
                  <Input
                    id="edit-meeting-day"
                    type="date"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="start">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-meeting-start">Starts</Label>
                  <Input
                    id="edit-meeting-start"
                    type="time"
                    required
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="minutes">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-meeting-minutes">Minutes</Label>
                  <Input
                    id="edit-meeting-minutes"
                    type="number"
                    required
                    min={5}
                    max={720}
                    step={5}
                    className="w-24"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                  />
                </div>
              )}
            </form.Field>
            <p className="col-span-full text-muted-foreground text-xs">
              Times are in {cityOf(zone)}.
            </p>
          </div>
        )}
        <form.Field name="location">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-meeting-location">Location</Label>
              <Input
                id="edit-meeting-location"
                maxLength={200}
                placeholder="Optional"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-meeting-description">Description</Label>
              <Textarea
                id="edit-meeting-description"
                maxLength={2000}
                placeholder="Optional"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) => <FormError error={error} />}
        </form.Subscribe>
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
        <form.Subscribe
          selector={(state) => [!state.values.title.trim(), state.isSubmitting] as const}
        >
          {([untitled, isSubmitting]) => (
            <Button type="submit" disabled={untitled || isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
};

export const EditMeetingDialog = ({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: MeetingDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogPopup>
      <EditMeetingForm meeting={meeting} onDone={() => onOpenChange(false)} />
    </DialogPopup>
  </Dialog>
);
