import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { ClockIcon, HourglassIcon } from "lucide-react";
import { ROOM_CAPACITY, type api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { slowModeText } from "./slow-mode.tsx";

export type Room = FunctionReturnType<typeof api.rooms.directory>["page"][number];

type RoomStatusProps = { people: number; closed?: boolean };

export const RoomStatus = ({ people, closed }: RoomStatusProps) =>
  closed ? (
    <Badge variant="outline">Closed</Badge>
  ) : people > 0 ? (
    <Badge variant="success">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      {people} here now
    </Badge>
  ) : (
    <Badge variant="outline">Empty right now</Badge>
  );

type RoomCardProps = { room: Room; closed?: boolean; action: ReactNode };

export const RoomCard = ({ room, closed, action }: RoomCardProps) => (
  <li className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
    <div className="flex items-center justify-between gap-3">
      <RoomStatus people={room.people} closed={closed} />
      {!closed && (
        <span className="font-mono text-muted-foreground text-xs tabular-nums">
          {ROOM_CAPACITY - room.people} of {ROOM_CAPACITY} seats free
        </span>
      )}
    </div>
    <div className="flex flex-col gap-1.5">
      <h2 className="font-semibold text-lg leading-6 tracking-tight">{room.title}</h2>
      <p className="text-muted-foreground text-sm">{room.description}</p>
    </div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="me-1 text-muted-foreground text-xs">Hosted by {room.host}</span>
        {room.waitingRoom && (
          <Badge variant="secondary">
            <HourglassIcon />
            Waiting room
          </Badge>
        )}
        {room.slowModeSeconds > 0 && (
          <Badge variant="secondary">
            <ClockIcon />
            One message {slowModeText(room.slowModeSeconds)}
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
    </div>
  </li>
);
