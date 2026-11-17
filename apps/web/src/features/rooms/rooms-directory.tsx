import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { ArmchairIcon, DoorOpenIcon, EyeIcon, FileTextIcon, ShieldCheckIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { EmptyState } from "#/components/empty-state.tsx";
import { RoomCard, type Room } from "./room-card.tsx";

const PAGE = 24;

const HOW_ROOMS_WORK = [
  {
    icon: EyeIcon,
    title: "No account needed",
    text: "Pick a name and you're in. Guests watch, listen and chat. Sign in to use your camera and mic.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Checked automatically",
    text: "An AI model checks chat and the odd video frame. Rude messages are removed, and doing it again gets you banned.",
  },
  {
    icon: FileTextIcon,
    title: "Recaps, never recordings",
    text: "Each visit leaves a public recap of when the room was busy and how many came. No names, faces or video.",
  },
];

export const RoomsDirectory = ({ initial }: { initial: Room[] }) => {
  const rooms = usePaginatedQuery(api.rooms.directory, {}, { initialNumItems: PAGE });
  const shown = rooms.status === "LoadingFirstPage" ? initial : rooms.results;

  return (
    <>
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
          Public rooms
        </h1>
        <p className="text-muted-foreground sm:text-base">
          Drop into a room and sit with other people while you work, read or do nothing at all.
          Camera on or off. No account needed to join and chat.
        </p>
      </section>
      {shown.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed py-10"
          icon={<ArmchairIcon />}
          title="No rooms are open right now"
          description="Organizations open public rooms from the app. Check back soon."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((room) => (
            <RoomCard
              key={room.code}
              room={room}
              action={
                <Button
                  variant="outline"
                  aria-label={`Join ${room.title}`}
                  render={<Link to="/rooms/$code" params={{ code: room.code }} />}
                >
                  <DoorOpenIcon />
                  Join
                </Button>
              }
            />
          ))}
        </ul>
      )}
      {rooms.status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => rooms.loadMore(PAGE)}>
          More rooms
        </Button>
      )}
      <section aria-labelledby="how-rooms-work" className="flex flex-col gap-4 border-t pt-8">
        <h2 id="how-rooms-work" className="font-medium text-muted-foreground text-sm">
          How public rooms work
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {HOW_ROOMS_WORK.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"
              >
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col gap-1 text-sm">
                <h3 className="font-medium">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};
