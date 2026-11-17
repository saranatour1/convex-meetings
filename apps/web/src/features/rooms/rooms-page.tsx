import { Link } from "@tanstack/react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArmchairIcon, CopyIcon, DoorOpenIcon, ShieldAlertIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import { EmptyState } from "#/components/empty-state.tsx";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { copyWithToast, showError } from "#/lib/errors.ts";
import { ModerationPanel } from "./moderation-panel.tsx";
import { NewRoomForm } from "./new-room-form.tsx";
import { RoomCard } from "./room-card.tsx";
import { roomLink } from "./room-link.ts";

export type RoomsTab = "browse" | "ours" | "moderation";

const TABS: { value: RoomsTab; label: string }[] = [
  { value: "browse", label: "Browse" },
  { value: "ours", label: "Ours" },
  { value: "moderation", label: "Moderation" },
];

const BrowseRooms = () => {
  const rooms = usePaginatedQuery(api.rooms.directory, {}, { initialNumItems: 24 });
  if (rooms.status !== "LoadingFirstPage" && rooms.results.length === 0) {
    return (
      <EmptyState
        className="rounded-xl border border-dashed py-10"
        icon={<ArmchairIcon />}
        title="No public rooms are open"
        description="Rooms that any organization opens to the public are listed here."
      />
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {rooms.results.map((room) => (
          <RoomCard
            key={room.code}
            room={room}
            action={
              <Button render={<Link to="/meetings/$code" params={{ code: room.code }} />}>
                <DoorOpenIcon />
                Join
              </Button>
            }
          />
        ))}
      </ul>
      {rooms.status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => rooms.loadMore(24)}>
          More rooms
        </Button>
      )}
    </>
  );
};

type OurRoomsProps = { canManage: boolean; onCreated: (code: string) => void };

const OurRooms = ({ canManage, onCreated }: OurRoomsProps) => {
  const { orgId, name } = useActiveOrg();
  const rooms = usePaginatedQuery(api.rooms.ours, { orgId }, { initialNumItems: 25 });
  const close = useMutation(api.rooms.close);
  return (
    <>
      {canManage && <NewRoomForm onCreated={onCreated} />}
      {rooms.status !== "LoadingFirstPage" && rooms.results.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed py-10"
          icon={<ArmchairIcon />}
          title={`${name} has no public rooms`}
          description={
            canManage
              ? "Open one above. It stays open until you close it."
              : "People who manage meetings can open one."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.results.map((room) => (
            <RoomCard
              key={room.code}
              room={room}
              closed={room.closedAt !== null}
              action={
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Copy the public link"
                    onClick={() => void copyWithToast(roomLink(room.code), "Public link copied")}
                  >
                    <CopyIcon />
                  </Button>
                  {canManage && room.closedAt === null && (
                    <Button
                      variant="ghost"
                      onClick={() => void close({ meetingId: room.meetingId }).catch(showError)}
                    >
                      Close room
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    render={<Link to="/meetings/$code" params={{ code: room.code }} />}
                  >
                    Open
                  </Button>
                </>
              }
            />
          ))}
        </ul>
      )}
      {rooms.status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => rooms.loadMore(25)}>
          More rooms
        </Button>
      )}
    </>
  );
};

type RoomsPageProps = { tab: RoomsTab; onCreated: (code: string) => void };

export const RoomsPage = ({ tab, onCreated }: RoomsPageProps) => {
  const { orgId } = useActiveOrg();
  const org = useQuery(api.orgs.get, { orgId });
  const canManage = org?.permissions.includes("manageMeetings") ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Public rooms</h1>
        <p className="text-muted-foreground text-sm">
          Rooms anyone can drop into, with or without an account. Chat and video are checked
          automatically.
        </p>
      </div>
      <nav className="flex gap-1 border-b">
        {TABS.filter((item) => item.value !== "moderation" || canManage).map((item) => (
          <Link
            key={item.value}
            to="/public-rooms"
            search={{ tab: item.value === "browse" ? undefined : item.value }}
            className={cn(
              "-mb-px border-transparent border-b-2 px-3 py-2 text-muted-foreground text-sm hover:text-foreground",
              tab === item.value && "border-foreground text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "browse" && <BrowseRooms />}
      {tab === "ours" && <OurRooms canManage={canManage} onCreated={onCreated} />}
      {tab === "moderation" &&
        (canManage ? (
          <ModerationPanel />
        ) : (
          org !== undefined && (
            <EmptyState
              className="rounded-xl border border-dashed py-10"
              icon={<ShieldAlertIcon />}
              title="Moderation is for people who manage meetings"
              description="Ask an admin if you need to see what was flagged."
            />
          )
        ))}
    </div>
  );
};
