import type { ReactNode } from "react";
import { DatabuddyProvider } from "@databuddy/sdk/react";
import { useQuery } from "convex/react";
import { api } from "@meetings/backend";

const clientId = import.meta.env.VITE_DATABUDDY_CLIENT_ID;

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const viewer = useQuery(api.users.viewer);

  return (
    <DatabuddyProvider
      clientId={clientId}
      disabled={!clientId}
      autocapture={{ webVitals: true, errors: true }}
      replay
      maskPaths={["/invite/*", "/join/*", "/meetings/*"]}
      user={
        viewer
          ? { id: viewer._id, traits: { email: viewer.email ?? null, name: viewer.name } }
          : null
      }
      userPending={viewer === undefined}
    >
      {children}
    </DatabuddyProvider>
  );
};
