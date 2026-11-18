import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  EyeIcon,
  FileTextIcon,
  HourglassIcon,
  ShieldCheckIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { ROOM_CAPACITY, api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { EmptyState } from "#/components/empty-state.tsx";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";
import { formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";
import { deviceId } from "./device-id.ts";
import { RoomStatus } from "./room-card.tsx";
import { slowModeText } from "./slow-mode.tsx";
import { useConvexPages, useConvexValue } from "#/features/data/live-query.ts";

export type RoomPreview = FunctionReturnType<typeof api.rooms.preview>;

const roomRules = (room: NonNullable<RoomPreview>) => [
  {
    icon: ShieldCheckIcon,
    lead: "Be kind.",
    text: "Insults, hate, threats, sexual content and advertising are removed, and doing it again gets you banned.",
  },
  {
    icon: VideoOffIcon,
    lead: "Keep your camera clean.",
    text: "Showing nudity, sex, gore or hate symbols on your camera or screen share gets you banned.",
  },
  {
    icon: EyeIcon,
    lead: "Checked automatically.",
    text: "Chat and occasional video frames are checked by an AI model.",
  },
  ...(room.waitingRoom
    ? [
        {
          icon: HourglassIcon,
          lead: "Waiting room.",
          text: "A host lets you in after you ask to join.",
        },
      ]
    : []),
  ...(room.slowModeSeconds > 0
    ? [
        {
          icon: ClockIcon,
          lead: "Slow mode is on.",
          text: `One message ${slowModeText(room.slowModeSeconds)}.`,
        },
      ]
    : []),
  {
    icon: FileTextIcon,
    lead: "Recaps are public.",
    text: "They show when the room was busy and how many people came, never names, faces or recordings.",
  },
];

const RoomRecaps = ({ code }: { code: string }) => {
  const recaps = useConvexPages(api.rooms.recaps, { code }, { initialNumItems: 5 });
  if (recaps.results.length === 0) return null;
  return (
    <section aria-labelledby="room-recaps" className="flex flex-col gap-2">
      <h2 id="room-recaps" className="px-1 font-medium text-muted-foreground text-sm">
        Recaps
      </h2>
      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border">
        {recaps.results.map((recap) => (
          <li key={recap.number}>
            <Link
              to="/rooms/$code/recaps/$number"
              params={{ code, number: recap.number }}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 tabular-nums">
                <span className="font-medium">
                  {formatDate(recap.startedAt, "UTC")} · {formatTime(recap.startedAt, "UTC")} UTC
                </span>
                <span className="text-muted-foreground text-xs">
                  {recap.endedAt
                    ? formatDuration(recap.endedAt - recap.startedAt) || "Under a minute"
                    : "Still going"}{" "}
                  · {recap.people} {recap.people === 1 ? "person" : "people"}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {recaps.status === "CanLoadMore" && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => recaps.loadMore(10)}
        >
          Earlier recaps
        </Button>
      )}
    </section>
  );
};

type RoomEntryProps = {
  code: string;
  initial: RoomPreview;
  onEntered: (secret: string) => void;
};

export const RoomEntry = ({ code, initial, onEntered }: RoomEntryProps) => {
  const live = useConvexValue(api.rooms.preview, { code });
  const room = live === undefined ? initial : live;
  const enter = useMutation(api.guests.enter);
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          onEntered(await enter({ code, name: value.name, device: deviceId() }));
          track("room_entered", { guest: true });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  if (!room) {
    return (
      <EmptyState
        icon={<DoorClosedIcon />}
        title="No public room here"
        description="Check the link, or look at the rooms that are open now."
        action={
          <Button variant="outline" render={<Link to="/rooms" />}>
            Browse public rooms
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        size="sm"
        variant="ghost"
        className="-ms-2.5 self-start text-muted-foreground"
        render={<Link to="/rooms" />}
      >
        <ArrowLeftIcon />
        All public rooms
      </Button>
      <div className="flex flex-wrap items-start gap-12">
        <article className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <RoomStatus people={room.people} closed={room.closedAt !== null} />
              <span className="text-muted-foreground text-xs">
                Public room hosted by {room.host}
              </span>
            </div>
            <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
              {room.title}
            </h1>
            <p className="max-w-xl text-muted-foreground sm:text-base">{room.description}</p>
          </header>

          <section aria-label="Right now" className="flex flex-col gap-2">
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border px-6 py-5">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs">Here now</dt>
                <dd className="font-semibold text-2xl tabular-nums">{room.people}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-xs">Seats free</dt>
                <dd className="font-semibold text-2xl tabular-nums">
                  {ROOM_CAPACITY - room.people}{" "}
                  <span className="font-normal text-muted-foreground text-sm">
                    of {ROOM_CAPACITY}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="px-1 text-muted-foreground text-xs">
              Visitors see how many people are here, never who.
            </p>
          </section>

          <section aria-labelledby="room-rules" className="flex flex-col gap-2">
            <h2 id="room-rules" className="font-semibold text-lg tracking-tight">
              Before you join
            </h2>
            <ul className="flex flex-col">
              {roomRules(room).map(({ icon: Icon, lead, text }) => (
                <li key={lead} className="flex gap-3 border-t py-3.5 text-sm">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 opacity-80" />
                  <p>
                    <span className="font-medium">{lead}</span>{" "}
                    <span className="text-muted-foreground">{text}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </article>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
          {room.closedAt ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-6">
              <h2 className="font-semibold text-lg leading-none">This room is closed</h2>
              <p className="text-muted-foreground text-sm">
                Its recaps stay up. Other rooms may be open now.
              </p>
              <Button variant="outline" className="self-start" render={<Link to="/rooms" />}>
                Browse public rooms
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4 rounded-2xl border p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <h2 className="font-semibold text-lg leading-none">Join as a guest</h2>
                <p className="text-muted-foreground text-sm">
                  Watch, listen and chat. No account needed.
                </p>
              </div>
              <form.Field name="name">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="room-guest-name">Your name</Label>
                    <Input
                      id="room-guest-name"
                      autoComplete="nickname"
                      maxLength={100}
                      required
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    <DoorOpenIcon />
                    {room.waitingRoom
                      ? isSubmitting
                        ? "Asking…"
                        : "Ask to join"
                      : isSubmitting
                        ? "Joining…"
                        : "Join as a guest"}
                  </Button>
                )}
              </form.Subscribe>
              {room.waitingRoom && (
                <p className="text-muted-foreground text-xs">
                  A host lets you in. You wait on the next page until they do.
                </p>
              )}
              <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
                {(error) => <FormError error={error} />}
              </form.Subscribe>
              <div aria-hidden className="flex items-center gap-3 text-muted-foreground text-xs">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                render={<Link to="/sign-in" search={{ redirect: `/rooms/${code}` }} />}
              >
                <VideoIcon />
                Sign in to use your camera
              </Button>
            </form>
          )}
          <RoomRecaps code={code} />
        </aside>
      </div>
    </div>
  );
};
