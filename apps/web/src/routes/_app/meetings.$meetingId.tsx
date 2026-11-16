import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@meetings/backend";
import type { CallPanel } from "#/features/meetings/call/call-room.tsx";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";

const PANELS = ["people", "chat", "polls"] as const;

type MeetingSearch = { panel?: CallPanel };

const MeetingRoute = () => {
  const { meetingId } = Route.useParams();
  const { panel } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <MeetingPage
        meetingId={meetingId as Id<"meetings">}
        onCancelled={() => void navigate({ to: "/" })}
        panel={panel}
        onPanelChange={(next) =>
          void navigate({
            search: (prev) => ({ ...prev, panel: next }),
            replace: true,
            resetScroll: false,
          })
        }
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/$meetingId")({
  validateSearch: (search: Record<string, unknown>): MeetingSearch => ({
    panel: PANELS.find((p) => p === search.panel),
  }),
  component: MeetingRoute,
});
