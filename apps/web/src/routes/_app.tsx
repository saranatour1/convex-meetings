import { track } from "@databuddy/sdk";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated, useMutation } from "convex/react";
import { api } from "@meetings/backend";
import { toastManager } from "@meetings/ui/components/toast";
import { SidebarInset, SidebarProvider } from "@meetings/ui/components/sidebar";
import { AppHeader } from "#/layouts/app-shell/app-header.tsx";
import { AppSidebar } from "#/layouts/app-shell/app-sidebar.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { OrgGate, useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";

const Header = () => {
  const { orgId } = useActiveOrg();
  const startNow = useMutation(api.meetings.startNow);
  const navigate = Route.useNavigate();

  return (
    <AppHeader
      onJoinCode={(code) => void navigate({ to: "/meetings/$code", params: { code } })}
      onStartMeeting={() =>
        void startNow({ orgId, timeZone: browserTimeZone() })
          .then(({ code }) => {
            track("meeting_started");
            return navigate({ to: "/meetings/$code", params: { code }, search: { call: true } });
          })
          .catch((error: unknown) =>
            toastManager.add({ title: describeError(error), type: "error" }),
          )
      }
    />
  );
};

const AppLayout = () => {
  const navigate = Route.useNavigate();

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <Navigate to="/sign-in" replace />
      </Unauthenticated>
      <Authenticated>
        <OrgGate onCreated={() => void navigate({ to: "/" })}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Header />
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </OrgGate>
      </Authenticated>
    </>
  );
};

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});
