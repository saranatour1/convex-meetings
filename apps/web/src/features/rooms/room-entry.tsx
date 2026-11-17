import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { DoorClosedIcon, DoorOpenIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { EmptyState } from "#/components/empty-state.tsx";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";
import { formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";
import { deviceId } from "./device-id.ts";
import { slowModeText } from "./slow-mode.tsx";

export type RoomPreview = FunctionReturnType<typeof api.rooms.preview>;

const RoomRecaps = ({ code }: { code: string }) => {
  const recaps = usePaginatedQuery(api.rooms.recaps, { code }, { initialNumItems: 5 });
  if (recaps.results.length === 0) return null;
  return (
    <section aria-labelledby="room-recaps" className="flex flex-col gap-2">
      <h2 id="room-recaps" className="font-medium">
        Recaps
      </h2>
      <ul className="flex flex-col gap-1">
        {recaps.results.map((recap) => (
          <li key={recap.number}>
            <Link
              to="/rooms/$code/recaps/$number"
              params={{ code, number: recap.number }}
              className="text-sm tabular-nums underline-offset-4 hover:underline"
            >
              {formatDate(recap.startedAt, "UTC")} · {formatTime(recap.startedAt, "UTC")} UTC
              {recap.endedAt &&
                ` · ${formatDuration(recap.endedAt - recap.startedAt) || "under a minute"}`}{" "}
              · {recap.people} {recap.people === 1 ? "person" : "people"} →
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
  const live = useQuery(api.rooms.preview, { code });
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
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="flex flex-wrap items-center gap-3 text-balance font-semibold text-3xl tracking-tight">
          {room.title}
          {room.closedAt ? (
            <Badge variant="outline">Closed</Badge>
          ) : room.people > 0 ? (
            <Badge variant="success">{room.people} here now</Badge>
          ) : (
            <Badge variant="outline">Empty right now</Badge>
          )}
        </h1>
        <p className="max-w-xl text-muted-foreground">{room.description}</p>
        <p className="text-muted-foreground text-sm">Public room hosted by {room.host}</p>
      </header>

      <section aria-labelledby="room-rules" className="rounded-xl border p-6">
        <h2 id="room-rules" className="font-medium">
          Before you join
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-muted-foreground text-sm">
          <li>
            Be kind. Insults, hate, threats, sexual content and advertising are removed, and doing
            it again gets you banned.
          </li>
          <li>Chat and occasional video frames are checked automatically by an AI model.</li>
          {room.waitingRoom && (
            <li>This room has a waiting room. A host lets you in after you ask to join.</li>
          )}
          {room.slowModeSeconds > 0 && (
            <li>Slow mode is on: one message {slowModeText(room.slowModeSeconds)}.</li>
          )}
          <li>Guests can watch, listen and chat. Sign in to turn on your camera and mic.</li>
          <li>
            Recaps of this room are public. They show when the room was busy and how many people
            came, never names, faces or recordings.
          </li>
        </ul>
      </section>

      {room.closedAt ? (
        <p className="text-muted-foreground text-sm">This room is closed.</p>
      ) : (
        <form
          className="flex max-w-sm flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
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
                    : "Ask to join as a guest"
                  : isSubmitting
                    ? "Joining…"
                    : "Join as a guest"}
              </Button>
            )}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
          <Button
            variant="outline"
            render={<Link to="/sign-in" search={{ redirect: `/meetings/${code}` }} />}
          >
            Sign in to use your camera
          </Button>
        </form>
      )}

      <RoomRecaps code={code} />
    </article>
  );
};
