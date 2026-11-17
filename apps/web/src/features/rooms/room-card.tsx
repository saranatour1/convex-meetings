import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { slowModeText } from "./slow-mode.tsx";

export type Room = FunctionReturnType<typeof api.rooms.directory>["page"][number];

type RoomCardProps = { room: Room; closed?: boolean; action: ReactNode };

export const RoomCard = ({ room, closed, action }: RoomCardProps) => (
  <li className="flex flex-wrap items-start gap-4 rounded-xl border p-4">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <h2 className="flex flex-wrap items-center gap-2 font-medium">
        {room.title}
        {closed ? (
          <Badge variant="outline">Closed</Badge>
        ) : room.people > 0 ? (
          <Badge variant="success">{room.people} here now</Badge>
        ) : (
          <Badge variant="outline">Empty right now</Badge>
        )}
      </h2>
      <p className="text-muted-foreground text-sm">{room.description}</p>
      <p className="text-muted-foreground text-xs">
        Hosted by {room.host}
        {room.slowModeSeconds > 0 && ` · One message ${slowModeText(room.slowModeSeconds)}`}
      </p>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
  </li>
);
