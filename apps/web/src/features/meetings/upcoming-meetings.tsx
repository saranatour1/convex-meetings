import type { ReactNode } from "react";
import { CalendarPlusIcon } from "lucide-react";
import { EmptyState } from "#/components/empty-state.tsx";

export function UpcomingMeetings({ scheduleAction }: { scheduleAction?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-sm">Upcoming</h2>
      <EmptyState
        className="rounded-xl border border-dashed py-10 md:py-12"
        icon={<CalendarPlusIcon />}
        title="No upcoming meetings"
        description="Meetings you schedule or get invited to will show up here."
        action={scheduleAction}
      />
    </section>
  );
}
