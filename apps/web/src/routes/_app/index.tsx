import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@meetings/ui/components/button";
import { UpcomingMeetings } from "#/features/meetings/upcoming-meetings.tsx";

const Home = () => {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <UpcomingMeetings
        scheduleAction={
          <Button size="sm" variant="outline" render={<Link to="/schedule" />}>
            Schedule a meeting
          </Button>
        }
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/")({ component: Home });
