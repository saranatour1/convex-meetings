import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@meetings/ui/components/select";
import { Switch } from "@meetings/ui/components/switch";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { MEETING_KINDS, type MeetingKind } from "#/features/meetings/meeting-kinds.ts";
import { describeError } from "#/lib/errors.ts";

type Settings = NonNullable<ReturnType<typeof useSettings>>;
const useSettings = () => useQuery(api.settings.getMine);

const LENGTHS = [15, 30, 45, 60, 90];
const INVITES = [
  { value: "everyone", label: "Anyone in my organizations" },
  { value: "managers", label: "Only people who can manage meetings" },
] as const;

const Row = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-6 py-3">
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-sm">{title}</span>
      <span className="text-muted-foreground text-sm">{description}</span>
    </div>
    {children}
  </div>
);

const MeetingSettingsForm = ({ settings }: { settings: Settings }) => {
  const save = useMutation(api.settings.setMine);
  const form = useForm({
    defaultValues: {
      joinMuted: settings.joinMuted,
      joinCameraOff: settings.joinCameraOff,
      defaultKind: settings.defaultKind,
      defaultMinutes: settings.defaultMinutes,
      defaultRecap: settings.defaultRecap,
      autoRecord: settings.autoRecord,
      invitesFrom: settings.invitesFrom,
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          await save(value);
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  const toggle = (
    name: "joinMuted" | "joinCameraOff" | "defaultRecap" | "autoRecord",
    title: string,
    description: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <Row title={title} description={description}>
          <Switch
            aria-label={title}
            checked={field.state.value}
            onCheckedChange={(checked) => field.handleChange(checked)}
          />
        </Row>
      )}
    </form.Field>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>Your defaults when you join or schedule a call.</CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col divide-y">
          {toggle("joinMuted", "Join with my mic off", "You can unmute in the lobby or the call.")}
          {toggle(
            "joinCameraOff",
            "Join with my camera off",
            "You can turn it on in the lobby or the call.",
          )}
          <form.Field name="defaultKind">
            {(field) => (
              <Row title="Default meeting type" description="Preselected when you schedule.">
                <Select
                  value={field.state.value}
                  onValueChange={(value) => value && field.handleChange(value as MeetingKind)}
                  items={MEETING_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                >
                  <SelectTrigger className="w-40" aria-label="Default meeting type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {MEETING_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Row>
            )}
          </form.Field>
          <form.Field name="defaultMinutes">
            {(field) => (
              <Row title="Default length" description="How long new meetings start out.">
                <Select
                  value={String(field.state.value)}
                  onValueChange={(value) => value && field.handleChange(Number(value))}
                  items={LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
                >
                  <SelectTrigger className="w-40" aria-label="Default length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {LENGTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} min
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Row>
            )}
          </form.Field>
          {toggle(
            "defaultRecap",
            "Transcript and summary",
            "New meetings get an AI recap after the call.",
          )}
          {toggle(
            "autoRecord",
            "Record my meetings",
            "Calls you host start recording when the first person joins.",
          )}
          <form.Field name="invitesFrom">
            {(field) => (
              <Row title="Who can invite me" description="Others can still see your working hours.">
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    value && field.handleChange(value as "everyone" | "managers")
                  }
                  items={INVITES.map((i) => ({ value: i.value, label: i.label }))}
                >
                  <SelectTrigger className="w-64" aria-label="Who can invite me">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {INVITES.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Row>
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
          <form.Subscribe selector={(state) => [state.isSubmitting, state.isSubmitSuccessful]}>
            {([isSubmitting, saved]) => (
              <>
                {saved && !isSubmitting && (
                  <span className="text-muted-foreground text-sm">Saved</span>
                )}
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

export const MeetingSettings = () => {
  const settings = useSettings();
  if (settings === undefined) return <LoadingScreen />;
  return <MeetingSettingsForm settings={settings} />;
};
