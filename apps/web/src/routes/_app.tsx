import { Navigate, Outlet, createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated, useMutation } from "convex/react";
import { api } from "@meetings/backend";
import { toastManager } from "@meetings/ui/components/toast";
import { SidebarInset, SidebarProvider } from "@meetings/ui/components/sidebar";
import { AppHeader } from "#/layouts/app-shell/app-header.tsx";
import { AppSidebar } from "#/layouts/app-shell/app-sidebar.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { InvitePanel } from "#/features/meetings/invite-panel.tsx";
import { OrgGate, useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";

type AppSearch = { org?: string; inviteFor?: string };

const Header = () => {
  const { orgId } = useActiveOrg();
  const startNow = useMutation(api.meetings.startNow);
  const navigate = Route.useNavigate();

  return (
    <AppHeader
      onJoinCode={(code) => void navigate({ to: "/meetings/$code", params: { code } })}
      onStartMeeting={() =>
        void startNow({ orgId, timeZone: browserTimeZone() })
          .then(({ code }) =>
            navigate({ to: "/meetings/$code", params: { code }, search: { call: true } }),
          )
          .catch((error: unknown) =>
            toastManager.add({ title: describeError(error), type: "error" }),
          )
      }
    />
  );
};

const AppLayout = () => {
  const { org, inviteFor } = Route.useSearch();
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
        <OrgGate
          requested={org}
          onCreated={(orgId) => void navigate({ to: "/", search: { org: orgId } })}
        >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Header />
              <Outlet />
            </SidebarInset>
            {inviteFor !== undefined && (
              <InvitePanel
                meetingTitle={inviteFor}
                onClose={() =>
                  void navigate({ search: (prev) => ({ ...prev, inviteFor: undefined }) })
                }
              />
            )}
          </SidebarProvider>
        </OrgGate>
      </Authenticated>
    </>
  );
};

export const Route = createFileRoute("/_app")({
  validateSearch: (search: Record<string, unknown>): AppSearch => ({
    org: typeof search.org === "string" ? search.org : undefined,
    inviteFor: typeof search.inviteFor === "string" ? search.inviteFor : undefined,
  }),
  search: { middlewares: [retainSearchParams(["org"])] },
  component: AppLayout,
});
