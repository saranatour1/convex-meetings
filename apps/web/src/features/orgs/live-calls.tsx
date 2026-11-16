import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { PhoneOffIcon, RadioIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { toastManager } from "@meetings/ui/components/toast";
import { describeError } from "#/lib/errors.ts";
import { formatAgo } from "#/lib/schedule.ts";
import { kindOf } from "#/features/meetings/meeting-kinds.ts";
import { useActiveOrg } from "./active-org.tsx";

export const LiveCalls = ({ canEnd }: { canEnd: boolean }) => {
  const { orgId } = useActiveOrg();
  const calls = useQuery(api.calls.live, { orgId });
  const end = useMutation(api.calls.end);
  if (!calls?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RadioIcon className="size-4 text-destructive-foreground" />
          Live now
        </CardTitle>
        <CardDescription>Calls happening in this organization right now.</CardDescription>
      </CardHeader>
      <CardPanel>
        <ul className="flex flex-col divide-y">
          {calls.map((call) => (
            <li key={call.sessionId} className="flex flex-wrap items-center gap-3 py-2">
              <Link
                to="/meetings/$code"
                params={{ code: call.code }}
                className="flex min-w-0 flex-1 flex-col"
              >
                <span className="truncate font-medium text-sm">{call.title}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {kindOf(call.kind).label} · started {formatAgo(call.startedAt)} · {call.count} in
                  the call: {call.people.join(", ")}
                </span>
              </Link>
              {canEnd && (
                <Button
                  size="sm"
                  variant="destructive-outline"
                  onClick={() =>
                    void end({ meetingId: call.meetingId })
                      .then(() => track("call_ended"))
                      .catch((error: unknown) =>
                        toastManager.add({ title: describeError(error), type: "error" }),
                      )
                  }
                >
                  <PhoneOffIcon />
                  End for everyone
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardPanel>
    </Card>
  );
};
