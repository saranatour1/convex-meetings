import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { cn } from "@meetings/ui/lib/utils";
import { avatarTint, getInitials } from "#/lib/initials.ts";

export const AlsoHere = () => {
  const { meeting } = useRealtimeKitMeeting();
  const ids = useRealtimeKitSelector((m) =>
    m.participants.joined
      .toArray()
      .filter((p) => p.stageStatus !== "ON_STAGE")
      .map((p) => p.id)
      .join(" "),
  );
  const people = ids.split(" ").flatMap((id) => meeting.participants.joined.get(id) ?? []);
  if (!people.length) return null;

  return (
    <div
      title="In the call without audio or video"
      className="absolute inset-x-0 top-2 z-10 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border bg-popover/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
    >
      <span className="text-muted-foreground">Also here</span>
      {people.map((person) => (
        <span key={person.id} className="flex items-center gap-1.5 font-medium">
          <Avatar className="size-5">
            {person.picture && <AvatarImage src={person.picture} alt="" />}
            <AvatarFallback className={cn("text-[0.6rem]", avatarTint(person.name))}>
              {getInitials(person.name)}
            </AvatarFallback>
          </Avatar>
          {person.name}
        </span>
      ))}
    </div>
  );
};
