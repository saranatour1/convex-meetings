import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { GuestEntry } from "#/features/meetings/guest-entry.tsx";

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
              void navigate({ to: "/guest/$secret", params: { secret }, replace: true })
            }
          />
        </div>
      </Unauthenticated>
    </>
  );
};

export const Route = createFileRoute("/m/$code")({ component: MeetingLinkPage });
