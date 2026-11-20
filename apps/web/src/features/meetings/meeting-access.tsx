import { track } from "@databuddy/sdk";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import {
  DoorOpenIcon,
  GlobeIcon,
  HandIcon,
  LockIcon,
  MailIcon,
  ScrollTextIcon,
  ShieldIcon,
} from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Label } from "@meetings/ui/components/label";
import { Radio, RadioGroup } from "@meetings/ui/components/radio-group";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@meetings/ui/components/select";
import { Switch } from "@meetings/ui/components/switch";
import { Textarea } from "@meetings/ui/components/textarea";
import { toastManager } from "@meetings/ui/components/toast";
import { EmptyState } from "#/components/empty-state.tsx";
import { SlowModeSelect } from "#/features/rooms/slow-mode.tsx";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { splitEmails } from "#/lib/emails.ts";
import { describeError, showError } from "#/lib/errors.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

type Access = "invited" | "org" | "ask" | "link" | "public";
type PrivateAccess = Exclude<Access, "public">;
type Inviters = "hosts" | "everyone";

const ACCESS: { value: PrivateAccess; label: string; hint: string }[] = [
  {
    value: "invited",
    label: "Only invited people",
    hint: "People need an invite from this page or the calendar.",
  },
  {
    value: "org",
    label: "Anyone in the organization",
    hint: "Members can open the link and walk in.",
  },
  {
    value: "ask",
    label: "Anyone with the link can ask to join",
    hint: "Your organization walks in. Anyone else waits until a host lets them in.",
  },
  {
    value: "link",
    label: "Anyone with the link",
    hint: "Guests join from their browser with just a name, no account.",
  },
];

const INVITERS: { value: Inviters; label: string }[] = [
  { value: "hosts", label: "Only hosts" },
  { value: "everyone", label: "Everyone in the meeting" },
];

export const meetingLink = (code: string) => `${window.location.origin}/m/${code}`;

type SettingsProps = {
  meetingId: Id<"meetings">;
  access: Access;
  inviters: Inviters;
  isProtected: boolean;
  slowModeSeconds: number;
  waitingRoom: boolean;
  liveText: boolean;
};

export const MeetingSettingsCard = ({
  meetingId,
  access,
  inviters,
  isProtected,
  slowModeSeconds,
  waitingRoom,
  liveText,
}: SettingsProps) => {
  const update = useMutation(api.meetings.updateSettings);
  const updateRoom = useMutation(api.rooms.update);
  const waiting = useConvexValue(
    api.rooms.waitingRoom,
    access === "public" ? { meetingId } : "skip",
  );
  const save = (changes: Omit<Parameters<typeof update>[0], "meetingId">) =>
    void update({ meetingId, ...changes }).catch(showError);
  const slowMode = (
    <div className="flex max-w-xs flex-col gap-2">
      <Label htmlFor="meeting-slow-mode">Slow mode in chat</Label>
      <SlowModeSelect
        id="meeting-slow-mode"
        value={slowModeSeconds}
        onChange={(seconds) => save({ slowModeSeconds: seconds })}
      />
      <span className="text-muted-foreground text-xs">Hosts can always write.</span>
    </div>
  );

  if (access === "public") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4" />
            Public room
          </CardTitle>
          <CardDescription>
            Anyone can join from the public page. Guests watch, listen and chat; signed-in people
            can use their camera and mic. Recording, drawing and snapshots are off, and chat and
            video are checked automatically.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <Label className="justify-between gap-3 font-normal">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                <HandIcon className="size-4" />
                Waiting room
              </span>
              <span className="text-muted-foreground text-xs">
                People outside your organization ask to join and a host lets each one in.
              </span>
              {waiting && waiting.joined > 0 && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {waiting.joined} asked to join · {waiting.admitted} let in · {waiting.waiting}{" "}
                  waiting now
                </span>
              )}
            </span>
            <Switch
              checked={waitingRoom}
              onCheckedChange={(on) =>
                void updateRoom({ meetingId, waitingRoom: on }).catch(showError)
              }
            />
          </Label>
          {slowMode}
        </CardPanel>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-4" />
            Access
          </CardTitle>
          <CardDescription>Who can get in, and who can bring others.</CardDescription>
        </div>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-sm">Who can join</legend>
            <RadioGroup
              value={access}
              onValueChange={(value) => save({ access: value as PrivateAccess })}
              className="gap-2"
            >
              {ACCESS.map((option) => (
                <Label key={option.value} className="items-start gap-2 font-normal">
                  <Radio value={option.value} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    <span className="text-muted-foreground text-xs">{option.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-inviters">Who can invite others</Label>
            <Select
              value={inviters}
              onValueChange={(value) => value && save({ inviters: value as Inviters })}
              items={INVITERS}
            >
              <SelectTrigger id="meeting-inviters">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {INVITERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </div>
        <Label className="justify-between gap-3 font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldIcon className="size-4" />
              Protected meeting
            </span>
            <span className="text-muted-foreground text-xs">
              Turns recording off and keeps downloads and saved annotations to hosts.
            </span>
          </span>
          <Switch checked={isProtected} onCheckedChange={(on) => save({ protected: on })} />
        </Label>
        <Label className="justify-between gap-3 font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <ScrollTextIcon className="size-4" />
              Live transcript
            </span>
            <span className="text-muted-foreground text-xs">
              Shows what people say as text during the call. Applies to people as they join or
              rejoin.
            </span>
          </span>
          <Switch checked={liveText} onCheckedChange={(on) => save({ liveText: on })} />
        </Label>
        {slowMode}
      </CardPanel>
    </Card>
  );
};

export const InviteToMeeting = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const invite = useMutation(api.meetings.invite);
  const form = useForm({
    defaultValues: { emails: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        const emails = splitEmails(value.emails);
        if (!emails.length) return "Add at least one email";
        if (emails.length > 30) return "Invite up to 30 people at a time";
        try {
          const { added, guests, resent, skipped } = await invite({ meetingId, emails });
          track("meeting_guests_invited", { members: added.length, guests: guests.length });
          formApi.reset();
          const parts = [
            added.length && `${added.length} from your organization`,
            guests.length &&
              `${guests.length} ${guests.length === 1 ? "guest" : "guests"} by email`,
          ].filter(Boolean);
          const sent = resent.length
            ? `Sent a new link to ${resent.join(", ")}. Their old link stops working.`
            : undefined;
          const already = skipped.length ? `Already invited: ${skipped.join(", ")}` : undefined;
          toastManager.add({
            title: parts.length
              ? `Invited ${parts.join(" and ")}`
              : resent.length
                ? "Sent new links"
                : "Nobody new to invite",
            description: [sent, already].filter(Boolean).join(" ") || undefined,
            type: "success",
          });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Label htmlFor="meeting-invite">Invite by email</Label>
      <div className="flex flex-wrap items-start gap-2">
        <form.Field name="emails">
          {(field) => (
            <Textarea
              id="meeting-invite"
              rows={1}
              className="min-w-56 flex-1"
              placeholder="colleague@acme.com, client@example.com"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              <MailIcon />
              Invite
            </Button>
          )}
        </form.Subscribe>
      </div>
      <span className="text-muted-foreground text-xs">
        People in your organization get an invite in their inbox. Anyone else gets a personal link
        by email and joins as a guest, no account needed.
      </span>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </form>
  );
};

export const MeetingDoor = ({ code }: { code: string }) => {
  const door = useConvexValue(api.meetings.door, { code });
  const enter = useMutation(api.meetings.enter);
  const ask = useMutation(api.joinRequests.ask);
  if (door === undefined) return <LoadingScreen />;
  if (door === null) {
    return (
      <EmptyState
        icon={<DoorOpenIcon />}
        title="No meeting with that code"
        description="Check the code or link, or ask whoever invited you to send it again."
      />
    );
  }
  return (
    <EmptyState
      icon={<DoorOpenIcon />}
      title={door.title}
      description={
        door.isPublic && door.canEnter
          ? "This is a public room. Chat and video are checked automatically, and breaking the rules gets you removed."
          : door.isPublic && door.canAsk && !door.request
            ? "This public room has a waiting room. Ask to join, and a host lets you in."
            : door.canEnter
              ? "You're not on the invite list, but this meeting is open to you."
              : door.request === "waiting"
                ? "You asked to join. This page opens the meeting as soon as a host lets you in."
                : door.request === "denied"
                  ? "A host didn't let you in."
                  : door.canAsk
                    ? "Ask to join, and a host can let you in."
                    : "Only invited people can join this meeting. Ask the host to invite you."
      }
      action={
        door.canEnter ? (
          <Button
            onClick={() =>
              void enter({ code })
                .then(() => track("meeting_entered"))
                .catch(showError)
            }
          >
            <DoorOpenIcon />
            {door.isPublic ? "Enter this room" : "Join this meeting"}
          </Button>
        ) : (
          door.canAsk &&
          door.request !== "waiting" && (
            <Button
              onClick={() =>
                void ask({ code })
                  .then(() => track("join_requested", { guest: false }))
                  .catch(showError)
              }
            >
              <HandIcon />
              {door.request === "denied" ? "Ask again" : "Ask to join"}
            </Button>
          )
        )
      }
    />
  );
};
