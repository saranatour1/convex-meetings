import { createContext, use, type ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { CreateOrgForm } from "./create-org-form.tsx";
import { JoinableOrgs } from "./joinable-orgs.tsx";

type Org = { _id: Id<"organizations">; name: string };
type ActiveOrg = { orgId: Id<"organizations">; name: string; orgs: Org[] };

const ActiveOrgContext = createContext<ActiveOrg | null>(null);

export const useActiveOrg = () => {
  const org = use(ActiveOrgContext);
  if (!org) throw new Error("useActiveOrg needs an OrgGate above it");
  return org;
};

export const useSwitchOrg = () =>
  useMutation(api.orgs.setActive).withOptimisticUpdate((store, { orgId }) => {
    const settings = store.getQuery(api.settings.getMine, {});
    if (settings)
      store.setQuery(
        api.settings.getMine,
        {},
        {
          ...settings,
          activeOrgId: orgId as Id<"organizations">,
        },
      );
  });

type OrgGateProps = {
  onCreated: (orgId: Id<"organizations">) => void;
  children: ReactNode;
};

export const OrgGate = ({ onCreated, children }: OrgGateProps) => {
  const { results, status } = usePaginatedQuery(api.orgs.listMine, {}, { initialNumItems: 50 });
  const settings = useQuery(api.settings.getMine);
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
