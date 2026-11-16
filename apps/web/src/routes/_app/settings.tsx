import { createFileRoute } from "@tanstack/react-router";
import { ScheduleSettings } from "#/features/schedules/schedule-settings.tsx";

const SettingsPage = () => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
    <ScheduleSettings />
  </main>
);

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });
