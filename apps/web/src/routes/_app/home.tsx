import { createFileRoute } from "@tanstack/react-router";
import { Launchpad } from "#/features/meetings/launchpad.tsx";
import { UpcomingMeetings } from "#/features/meetings/upcoming-meetings.tsx";

const Home = () => {
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 lg:p-8">
      <Launchpad
        onOpenCall={(code) =>
          void navigate({ to: "/meetings/$code", params: { code }, search: { call: true } })
        }
      />
      <UpcomingMeetings />
    </main>
  );
};

export const Route = createFileRoute("/_app/home")({ component: Home });
