import { track } from "@databuddy/sdk";
import { useMutation, useQuery } from "convex/react";
import { BuildingIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
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

export const JoinableOrgs = ({ onJoined }: { onJoined: (orgId: Id<"organizations">) => void }) => {
  const orgs = useQuery(api.orgs.joinable);
  const join = useMutation(api.orgs.joinWithDomain);
  if (!orgs?.length) return null;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Organizations you can join</CardTitle>
        <CardDescription>
          They let anyone with a verified @{orgs[0]!.domain} email in.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <ul className="flex flex-col divide-y">
          {orgs.map((org) => (
            <li key={org._id} className="flex items-center gap-3 py-2">
              <BuildingIcon className="size-4 opacity-70" />
              <span className="flex-1 truncate font-medium text-sm">{org.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void join({ orgId: org._id })
                    .then(() => {
                      track("organization_joined", { via: "domain" });
                      onJoined(org._id);
                    })
                    .catch((error: unknown) =>
                      toastManager.add({ title: describeError(error), type: "error" }),
                    )
                }
              >
                Join
              </Button>
            </li>
          ))}
        </ul>
      </CardPanel>
    </Card>
  );
};
