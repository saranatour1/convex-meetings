import { createFileRoute } from "@tanstack/react-router";
import { CreateOrgForm } from "#/features/orgs/create-org-form.tsx";
import { JoinableOrgs } from "#/features/orgs/joinable-orgs.tsx";

const NewOrgPage = () => {
  const navigate = Route.useNavigate();
  return (
    <main className="flex flex-col items-center gap-4 p-4 lg:p-6">
      <JoinableOrgs onJoined={(orgId) => void navigate({ to: "/", search: { org: orgId } })} />
      <CreateOrgForm
        title="New organization"
        description="Start a separate space with its own members and meetings."
        onCreated={(orgId) => void navigate({ to: "/", search: { org: orgId } })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/orgs/new")({ component: NewOrgPage });
