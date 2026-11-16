import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { SidebarInset, SidebarProvider } from "@meetings/ui/components/sidebar";
import { AppHeader } from "#/layouts/app-shell/app-header.tsx";
import { AppSidebar } from "#/layouts/app-shell/app-sidebar.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { InvitePanel } from "#/features/meetings/invite-panel.tsx";

type AppSearch = { inviteFor?: string };

const AppLayout = () => {
  const { inviteFor } = Route.useSearch();
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
      </Authenticated>
    </>
  );
};

export const Route = createFileRoute("/_app")({
  validateSearch: (search: Record<string, unknown>): AppSearch => ({
    inviteFor: typeof search.inviteFor === "string" ? search.inviteFor : undefined,
  }),
  component: AppLayout,
});
