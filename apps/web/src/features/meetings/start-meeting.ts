import { track } from "@databuddy/sdk";
import { useMutation } from "convex/react";
import { api } from "@meetings/backend";
import { toastManager } from "@meetings/ui/components/toast";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";

export const useStartMeeting = (onStarted: (code: string) => void) => {
  const { orgId } = useActiveOrg();
  const startNow = useMutation(api.meetings.startNow);

  return () =>
    void startNow({ orgId, timeZone: browserTimeZone() })
      .then(({ code }) => {
        track("meeting_started");
        onStarted(code);
      })
      .catch((error: unknown) => toastManager.add({ title: describeError(error), type: "error" }));
};
