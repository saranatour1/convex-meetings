import { Navigate, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { SidebarInset, SidebarProvider } from "@meetings/ui/components/sidebar";
import { AppHeader } from "#/layouts/app-shell/app-header.tsx";
import { AppSidebar } from "#/layouts/app-shell/app-sidebar.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { AgentTools } from "#/features/meetings/agent-tools.tsx";
import { IncomingCall } from "#/features/meetings/incoming-call.tsx";
import { useStartMeeting } from "#/features/meetings/start-meeting.ts";
import { OrgGate } from "#/features/orgs/active-org.tsx";

const Header = ({ onOpenCall }: { onOpenCall: (code: string) => void }) => {
  const onHome = Boolean(useMatchRoute()({ to: "/home" }));
  const startMeeting = useStartMeeting(onOpenCall);

  return <AppHeader quickActions={!onHome} onJoinCode={onOpenCall} onStartMeeting={startMeeting} />;
};

const AppLayout = () => {
  const navigate = Route.useNavigate();
  const openCall = (code: string) =>
    void navigate({ to: "/meetings/$code", params: { code }, search: { call: true } });

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <Navigate to="/sign-in" replace />
      </Unauthenticated>
      <Authenticated>
        <OrgGate onCreated={() => void navigate({ to: "/home" })}>
          <IncomingCall onAnswered={openCall} />
          <AgentTools onOpenCall={openCall} />
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Header onOpenCall={openCall} />
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
