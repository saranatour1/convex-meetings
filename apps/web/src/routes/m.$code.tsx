import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { GuestEntry } from "#/features/meetings/guest-entry.tsx";
import { pageHead } from "#/lib/seo.ts";

const MeetingLinkPage = () => {
  const { code } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Authenticated>
        <Navigate to="/meetings/$code" params={{ code }} replace />
      </Authenticated>
      <Unauthenticated>
        <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
          <GuestEntry
            code={code}
            onEntered={(secret) =>
              void navigate({
                to: "/guest/$secret",
                params: { secret },
                search: { code },
                replace: true,
              })
            }
          />
        </div>
      </Unauthenticated>
    </>
  );
};

export const Route = createFileRoute("/m/$code")({
  ssr: "data-only",
  head: () =>
    pageHead({
      title: "Join the meeting · Meetings",
      description: "Open this link to join the meeting in your browser.",
    }),
  component: MeetingLinkPage,
});
