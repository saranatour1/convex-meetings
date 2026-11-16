import { Navigate, Outlet, createFileRoute, retainSearchParams } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { SidebarInset, SidebarProvider } from "@meetings/ui/components/sidebar";
import { AppHeader } from "#/layouts/app-shell/app-header.tsx";
import { AppSidebar } from "#/layouts/app-shell/app-sidebar.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { InvitePanel } from "#/features/meetings/invite-panel.tsx";
import { OrgGate } from "#/features/orgs/active-org.tsx";

type AppSearch = { org?: string; inviteFor?: string };

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
              <AppHeader />
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
