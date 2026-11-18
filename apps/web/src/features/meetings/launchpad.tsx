import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";

import { CalendarClockIcon, LinkIcon, PlusIcon, VideoIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { FormError } from "#/components/form-error.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { parseMeetingCode } from "#/lib/meeting-code.ts";
import { formatDayHeading, wallMinutes } from "#/lib/schedule.ts";
import { useMinute } from "./clock.ts";
import { useStartMeeting } from "./start-meeting.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

const greetingAt = (now: number, timeZone: string) => {
  const minutes = wallMinutes(now, timeZone);
  if (minutes < 12 * 60) return "Good morning";
  return minutes < 18 * 60 ? "Good afternoon" : "Good evening";
};

type ActionProps = { icon: ReactNode; title: ReactNode; description: string; children: ReactNode };

const Action = ({ icon, title, description, children }: ActionProps) => (
  <div className="flex flex-col gap-3 bg-card p-5 lg:p-6">
    <span className="grid size-9 place-items-center rounded-lg bg-muted [&_svg]:size-4.5">
      {icon}
    </span>
    <div className="flex flex-col gap-0.5">
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    <div className="mt-auto flex flex-col gap-2">{children}</div>
  </div>
);

export const Launchpad = ({ onOpenCall }: { onOpenCall: (code: string) => void }) => {
  const viewer = useConvexValue(api.users.viewer, {});
  const now = useMinute();
  const zone = browserTimeZone();
  const startMeeting = useStartMeeting(onOpenCall);
  const form = useForm({
    defaultValues: { code: "" },
    validators: {
      onSubmit: ({ value }) =>
        parseMeetingCode(value.code) ? undefined : "Paste a code like abc-defg-hij, or a link.",
    },
    onSubmit: ({ value, formApi }) => {
      const code = parseMeetingCode(value.code);
      if (!code) return;
      onOpenCall(code);
      formApi.reset();
    },
  });
  const firstName = viewer?.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          {greetingAt(now, zone)}
          {firstName && `, ${firstName}`}
        </h1>
        <p className="text-muted-foreground text-sm">{formatDayHeading(now, zone)}</p>
      </div>

      <section
        aria-label="Start or join a call"
        className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3"
      >
        <Action
          icon={<VideoIcon />}
          title="Start a call"
          description="Opens your lobby with a new link to share."
        >
          <Button className="self-start" onClick={startMeeting}>
            <VideoIcon />
            Start now
          </Button>
        </Action>

        <Action
          icon={<LinkIcon />}
          title={<label htmlFor="launchpad-code">Join with a code</label>}
          description="Paste a code or a full link."
        >
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="code">
              {(field) => (
                <Input
                  id="launchpad-code"
                  className="min-w-32 flex-1 font-mono"
                  placeholder="abc-defg-hij"
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>
            <Button variant="outline" type="submit">
              Join
            </Button>
          </form>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
        </Action>

        <Action
          icon={<CalendarClockIcon />}
          title="Schedule"
          description="Pick a day and a time, then invite people."
        >
          <Button className="self-start" variant="outline" render={<Link to="/schedule" />}>
            <PlusIcon />
            Schedule
          </Button>
        </Action>
      </section>
    </div>
  );
};
