import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSettings } from "#/features/settings/appearance-settings.tsx";
import { ScheduleSettings } from "#/features/schedules/schedule-settings.tsx";

const GeneralSettings = () => (
  <div className="flex flex-col gap-6">
    <AppearanceSettings />
    <ScheduleSettings />
  </div>
);

export const Route = createFileRoute("/_app/settings/general")({ component: GeneralSettings });
