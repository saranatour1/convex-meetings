import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { memberToPerson } from "#/features/orgs/people.ts";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { cityOf } from "#/lib/schedule.ts";
import { ScheduleForm, type ScheduleFormProps } from "./schedule-form.tsx";

const DAY_MS = 86_400_000;

type ScheduleMeetingProps = Omit<
  ScheduleFormProps,
  "invitees" | "homeZone" | "alsoShow" | "onSchedule"
> & { onScheduled: (meetingId: Id<"meetings">) => void };

export const ScheduleMeeting = ({ onScheduled, ...props }: ScheduleMeetingProps) => {
  const { orgId } = useActiveOrg();
  const create = useMutation(api.meetings.create);
  const from = Math.floor(Date.now() / DAY_MS) * DAY_MS - DAY_MS;
  const busy = useQuery(api.meetings.busy, { orgId, from, to: from + 62 * DAY_MS });
  const members = usePaginatedQuery(api.members.list, { orgId }, { initialNumItems: 100 });
  const viewer = useQuery(api.users.viewer);
  const schedule = useQuery(api.schedules.getMine);
  if (members.status === "LoadingFirstPage" || viewer === undefined || schedule === undefined) {
    return <LoadingScreen />;
  }

  const now = Date.now();
  const people = members.results.map((member) => ({
    ...memberToPerson(member, now),
    busy: busy?.[member.userId] ?? [],
  }));
  const homeZone = schedule?.timeZone ?? browserTimeZone();
  const organizer = people.find((p) => p.id === viewer?._id) ?? {
    id: viewer?._id ?? "me",
    name: viewer?.name ?? "You",
    initials: getInitials(viewer?.name ?? "You"),
    city: cityOf(homeZone),
    timeZone: homeZone,
    hours: [],
    share: "none" as const,
    busy: [],
  };

  return (
    <ScheduleForm
      {...props}
      onSchedule={async (meeting) => {
        try {
          onScheduled(
            await create({
              ...meeting,
              orgId,
              inviteeIds: meeting.inviteeIds as Id<"users">[],
            }),
          );
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      }}
      invitees={{ organizer, people: people.filter((p) => p.id !== organizer.id), teams: [] }}
      homeZone={homeZone}
      alsoShow={schedule?.alsoShow ?? []}
    />
  );
};
