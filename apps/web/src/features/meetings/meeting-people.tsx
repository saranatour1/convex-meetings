import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckIcon, EllipsisIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@meetings/ui/components/menu";
import { cn } from "@meetings/ui/lib/utils";
import { LiveDot } from "#/components/live-dot.tsx";
import { showError } from "#/lib/errors.ts";
import { avatarTint, getInitials } from "#/lib/initials.ts";
import { InviteToMeeting } from "./meeting-access.tsx";

export type MeetingDetails = NonNullable<FunctionReturnType<typeof api.meetings.get>>;
type Person = MeetingDetails["people"][number];

export const othersInCall = (meeting: MeetingDetails) =>
  meeting.people
    .filter((person) => person.inCall && person._id !== meeting.me._id)
    .map((person) => person.name);

const statusOf = (person: Person, room: boolean) => {
  if (person.role === "host") return "Host";
  if (room) return "Visitor";
  return { accepted: "Going", declined: "Not going", pending: "No reply yet" }[person.response];
};

const PersonMenu = ({ person }: { person: Person }) => {
  const remove = useMutation(api.calls.remove);
  const letIn = useMutation(api.calls.letIn);

  return (
    <Menu>
      <MenuTrigger
        render={<Button size="icon-sm" variant="ghost" aria-label={`Options for ${person.name}`} />}
      >
        <EllipsisIcon />
      </MenuTrigger>
      <MenuPopup align="end">
        {person.removed ? (
          <MenuItem onClick={() => void letIn({ meetingMemberId: person._id }).catch(showError)}>
            <UserCheckIcon />
            Let back in
          </MenuItem>
        ) : (
          <MenuItem
            variant="destructive"
            onClick={() => void remove({ meetingMemberId: person._id }).catch(showError)}
          >
            <UserXIcon />
            Remove from call
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
};

export const MeetingPeople = ({ meeting, room }: { meeting: MeetingDetails; room: boolean }) => {
  const going = meeting.people.filter((person) => person.response === "accepted").length;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-3">
        <CardTitle>People</CardTitle>
        {!room && (
          <CardDescription className="tabular-nums">
            {meeting.people.length} invited · {going} going
          </CardDescription>
        )}
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {meeting.me.canInvite && !room && <InviteToMeeting meetingId={meeting._id} />}
        <ul className="-mx-2 flex flex-col">
          {meeting.people.map((person) => {
            const status = statusOf(person, room);
            return (
              <li key={person._id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                <Avatar className="size-8">
                  {person.imageUrl && <AvatarImage src={person.imageUrl} alt="" />}
                  <AvatarFallback className={cn("font-medium text-xs", avatarTint(person.name))}>
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-sm">
                    <span className="truncate">{person.name}</span>
                    {person._id === meeting.me._id && (
                      <span className="font-normal text-muted-foreground">(you)</span>
                    )}
                    {person.isGuest && (
                      <Badge variant="outline" size="sm">
                        {person.agent ? "AI agent" : "Guest"}
                      </Badge>
                    )}
                    {person.removed && (
                      <Badge variant="error" size="sm">
                        Removed
                      </Badge>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      status === "Going" ? "text-success-foreground" : "text-muted-foreground",
                    )}
                  >
                    {status === "Going" && <CheckIcon className="size-3" />}
                    {status}
                    {person.inCall && (
                      <span className="ms-1 flex items-center gap-1.5 text-success-foreground">
                        <LiveDot />
                        In the call
                      </span>
                    )}
                  </span>
                </span>
                {meeting.me.canControl && person._id !== meeting.me._id && (
                  <PersonMenu person={person} />
                )}
              </li>
            );
          })}
        </ul>
      </CardPanel>
    </Card>
  );
};
