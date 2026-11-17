import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { ArmchairIcon, DoorOpenIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { EmptyState } from "#/components/empty-state.tsx";
import { RoomCard, type Room } from "./room-card.tsx";

const PAGE = 24;

export const RoomsDirectory = ({ initial }: { initial: Room[] }) => {
  const rooms = usePaginatedQuery(api.rooms.directory, {}, { initialNumItems: PAGE });
  const shown = rooms.status === "LoadingFirstPage" ? initial : rooms.results;

  return (
    <>
      <section className="flex flex-col gap-3">
        <h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
          Public rooms
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Drop into a room and sit with other people while you work, read or do nothing at all.
          Camera on or off. No account needed to join and chat.
        </p>
      </section>
      {shown.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed py-10"
          icon={<ArmchairIcon />}
          title="No rooms are open right now"
          description="Organizations open public rooms from the app. Check back soon."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((room) => (
            <RoomCard
              key={room.code}
              room={room}
              action={
                <Button render={<Link to="/rooms/$code" params={{ code: room.code }} />}>
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
    </>
  );
};
