import { createContext, use, type ReactNode } from "react";
import { createOptimisticAction } from "@tanstack/db";
import { useConvex } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api, type Id } from "@meetings/backend";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { CreateOrgForm } from "./create-org-form.tsx";
import { JoinableOrgs } from "./joinable-orgs.tsx";
import { useConvexPages, useConvexValue, valueCollection } from "#/features/data/live-query.ts";

type Org = { _id: Id<"organizations">; name: string };
type ActiveOrg = { orgId: Id<"organizations">; name: string; orgs: Org[] };

const ActiveOrgContext = createContext<ActiveOrg | null>(null);

export const useActiveOrg = () => {
  const org = use(ActiveOrgContext);
  if (!org) throw new Error("useActiveOrg needs an OrgGate above it");
  return org;
};

export const useSwitchOrg = () => {
  const client = useConvex();
  const settings = valueCollection(client, api.settings.getMine, {});
  const switchNow = createOptimisticAction<FunctionArgs<typeof api.orgs.setActive>>({
    onMutate: ({ orgId }) => {
      if (!settings.has("value")) return;
      settings.update("value", (row) => {
        row.value = { ...row.value, activeOrgId: orgId as Id<"organizations"> };
      });
    },
    mutationFn: (args) => client.mutation(api.orgs.setActive, args),
  });
  return (args: FunctionArgs<typeof api.orgs.setActive>) => switchNow(args).when("settled");
};

type OrgGateProps = {
  onCreated: (orgId: Id<"organizations">) => void;
  children: ReactNode;
};

export const OrgGate = ({ onCreated, children }: OrgGateProps) => {
  const { results, status } = useConvexPages(api.orgs.listMine, {}, { initialNumItems: 50 });
  const settings = useConvexValue(api.settings.getMine, {});
  if (status === "LoadingFirstPage" || settings === undefined) return <LoadingScreen />;
  const active = results.find((org) => org._id === settings.activeOrgId) ?? results[0];
  if (!active) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-sidebar p-4">
        <JoinableOrgs onJoined={onCreated} />
        <CreateOrgForm
          title="Create your organization"
          description="Everyone you meet with joins an organization. You can invite them next."
          onCreated={onCreated}
        />
      </div>
    );
  }
  return (
    <ActiveOrgContext value={{ orgId: active._id, name: active.name, orgs: results }}>
      {children}
    </ActiveOrgContext>
  );
};
