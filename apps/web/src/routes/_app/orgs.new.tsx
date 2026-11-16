import { createFileRoute } from "@tanstack/react-router";
import { CreateOrgForm } from "#/features/orgs/create-org-form.tsx";

const NewOrgPage = () => {
  const navigate = Route.useNavigate();
  return (
    <main className="grid place-items-center p-4 lg:p-6">
      <CreateOrgForm
        title="New organization"
        description="Start a separate space with its own members and meetings."
        onCreated={(orgId) => void navigate({ to: "/", search: { org: orgId } })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/orgs/new")({ component: NewOrgPage });
