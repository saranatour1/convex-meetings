import type { ReactNode } from "react";
import { DatabuddyProvider } from "@databuddy/sdk/react";
import { useQuery } from "convex/react";
import { api } from "@meetings/backend";
import type { MeetingKind } from "#/features/meetings/meeting-kinds.ts";
import { DATABUDDY_CLIENT_ID } from "#/lib/databuddy.ts";

declare module "@databuddy/sdk" {
  interface Events {
    signed_in: { method: "password" | "passkey" | "oauth" };
    passkey_added: undefined;
    sign_in_started: { method: "google" | "github" };
    organization_created: undefined;
    organization_joined: { via: "invite" | "link" | "domain" };
    members_invited: { count: number };
    join_link_created: { days: number };
    meeting_scheduled: { kind: MeetingKind; repeats: boolean };
    meeting_started: undefined;
    call_rung: undefined;
    call_answered: { accept: boolean };
    meeting_entered: undefined;
    meeting_responded: { response: "accepted" | "declined" };
    meeting_guests_invited: { members: number; guests: number };
    meeting_cancelled: undefined;
    guest_entered: undefined;
    call_joined: { kind: MeetingKind; guest: boolean };
    call_ended: undefined;
    chat_message_sent: { guest: boolean };
  }
}

const clientId = import.meta.env.PROD
  ? DATABUDDY_CLIENT_ID
  : import.meta.env.VITE_DATABUDDY_CLIENT_ID;

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const viewer = useQuery(api.users.viewer);

  return (
    <DatabuddyProvider
      clientId={clientId}
      disabled={!clientId}
      autocapture={{ webVitals: true, errors: true }}
      replay
      maskPaths={[
        "/invite/*",
        "/join/*",
        "/guest/*",
        "/m/*",
        "/meetings/*",
        "/meetings/*/recaps/*",
      ]}
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
