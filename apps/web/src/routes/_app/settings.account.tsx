import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "#/features/settings/account-settings.tsx";

export const Route = createFileRoute("/_app/settings/account")({ component: AccountSettings });
