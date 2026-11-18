import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { useConvex } from "convex/react";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { cn } from "@meetings/ui/lib/utils";
import { avatarTint, getInitials } from "#/lib/initials.ts";
import { useGuestPass } from "../guest-pass.ts";
import { meetingPeople } from "../live-collections.ts";

type Here = { id: string; name: string; picture?: string | null; agent: boolean };

const Chip = ({ person }: { person: Here }) => (
  <span className="flex items-center gap-1.5 font-medium">
    <Avatar className={person.agent ? "size-6" : "size-5"}>
      {person.picture && <AvatarImage src={person.picture} alt="" />}
      <AvatarFallback className={cn("text-[0.6rem]", avatarTint(person.name))}>
        {getInitials(person.name)}
      </AvatarFallback>
    </Avatar>
    {person.name}
    {person.agent && <span className="font-normal text-muted-foreground">AI agent</span>}
  </span>
);

export const AlsoHere = ({ code, offStage }: { code: string; offStage: boolean }) => {
  const { meeting } = useRealtimeKitMeeting();
  const pass = useGuestPass();
  const people = meetingPeople(useConvex(), code, pass);
  const { data: inCall } = useLiveQuery((q) =>
    q.from({ person: people }).where(({ person }) => eq(person.inCall, true)),
  );
  const ids = useRealtimeKitSelector((m) =>
    m.participants.joined
      .toArray()
      .filter((p) => p.stageStatus !== "ON_STAGE")
      .map((p) => p.id)
      .join(" "),
  );
  const here: Here[] = [
    ...inCall
      .filter((person) => person.agent)
      .map((person) => ({
        id: person._id,
        name: person.name,
        picture: person.imageUrl,
        agent: true,
      })),
    ...(offStage ? ids.split(" ") : []).flatMap((id) => {
      const peer = meeting.participants.joined.get(id);
      return peer ? [{ id: peer.id, name: peer.name, picture: peer.picture, agent: false }] : [];
    }),
  ];
  if (!here.length) return null;

  return (
    <div className="absolute inset-x-0 top-2 z-10 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border bg-popover/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
      <span className="text-muted-foreground">Also here</span>
      {here.map((person) => (
        <Chip key={person.id} person={person} />
      ))}
    </div>
  );
};
