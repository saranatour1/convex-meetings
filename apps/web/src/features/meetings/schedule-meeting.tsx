import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@meetings/backend";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { memberToPerson } from "#/features/orgs/people.ts";
import { browserTimeZone } from "#/lib/browser.ts";
import { getInitials } from "#/lib/initials.ts";
import { cityOf } from "#/lib/schedule.ts";
import { ScheduleForm, type ScheduleFormProps } from "./schedule-form.tsx";

type ScheduleMeetingProps = Omit<ScheduleFormProps, "invitees" | "homeZone" | "alsoShow">;

export const ScheduleMeeting = (props: ScheduleMeetingProps) => {
  const { orgId } = useActiveOrg();
  const members = usePaginatedQuery(api.members.list, { orgId }, { initialNumItems: 100 });
  const viewer = useQuery(api.users.viewer);
  const schedule = useQuery(api.schedules.getMine);
  if (members.status === "LoadingFirstPage" || viewer === undefined || schedule === undefined) {
    return <LoadingScreen />;
  }

  const now = Date.now();
  const people = members.results.map((member) => memberToPerson(member, now));
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
      invitees={{ organizer, people: people.filter((p) => p.id !== organizer.id), teams: [] }}
      homeZone={homeZone}
      alsoShow={schedule?.alsoShow ?? []}
    />
  );
};
