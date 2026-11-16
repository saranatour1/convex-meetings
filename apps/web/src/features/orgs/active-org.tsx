import { createContext, use, type ReactNode } from "react";
import { usePaginatedQuery } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { CreateOrgForm } from "./create-org-form.tsx";

type Org = { _id: Id<"organizations">; name: string };
type ActiveOrg = { orgId: Id<"organizations">; name: string; orgs: Org[] };

const ActiveOrgContext = createContext<ActiveOrg | null>(null);

export const useActiveOrg = () => {
  const org = use(ActiveOrgContext);
  if (!org) throw new Error("useActiveOrg needs an OrgGate above it");
  return org;
};

type OrgGateProps = {
  requested?: string;
  onCreated: (orgId: Id<"organizations">) => void;
  children: ReactNode;
};

export const OrgGate = ({ requested, onCreated, children }: OrgGateProps) => {
  const { results, status } = usePaginatedQuery(api.orgs.listMine, {}, { initialNumItems: 50 });
  if (status === "LoadingFirstPage") return <LoadingScreen />;
  const active = results.find((org) => org._id === requested) ?? results[0];
  if (!active) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
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
