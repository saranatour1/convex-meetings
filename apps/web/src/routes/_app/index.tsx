import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@meetings/ui/components/button";
import { ScheduleForm } from "#/features/meetings/schedule-form.tsx";
import { UpcomingMeetings } from "#/features/meetings/upcoming-meetings.tsx";

export const Route = createFileRoute("/_app/")({ component: Home });

function Home() {
  const { schedule } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      {schedule && (
        <ScheduleForm
          onInvite={(meetingTitle) =>
            void navigate({ search: (prev) => ({ ...prev, inviteFor: meetingTitle }) })
          }
          onClose={() =>
            void navigate({
              search: (prev) => ({ ...prev, schedule: undefined, inviteFor: undefined }),
            })
          }
        />
      )}
      <UpcomingMeetings
        scheduleAction={
          !schedule && (
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/" search={(prev) => ({ ...prev, schedule: true })} />}
            >
              Schedule a meeting
            </Button>
          )
        }
      />
    </main>
  );
}
