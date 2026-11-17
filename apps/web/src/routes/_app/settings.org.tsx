import { createFileRoute } from "@tanstack/react-router";
import { OrgSettings } from "#/features/orgs/org-settings.tsx";

const OrgSettingsPage = () => {
  const navigate = Route.useNavigate();
  return <OrgSettings onLeft={() => void navigate({ to: "/home" })} />;
};

export const Route = createFileRoute("/_app/settings/org")({ component: OrgSettingsPage });
