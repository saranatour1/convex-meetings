import { createFileRoute } from "@tanstack/react-router";
import { OrgSettings } from "#/features/orgs/org-settings.tsx";

export const Route = createFileRoute("/_app/settings/org")({ component: OrgSettings });
