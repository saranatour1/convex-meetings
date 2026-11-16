import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@meetings/backend";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";

const MeetingRoute = () => {
  const { meetingId } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <MeetingPage
        meetingId={meetingId as Id<"meetings">}
        onCancelled={() => void navigate({ to: "/" })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/$meetingId")({ component: MeetingRoute });
