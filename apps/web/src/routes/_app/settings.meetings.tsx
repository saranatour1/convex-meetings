import { createFileRoute } from "@tanstack/react-router";
import { MeetingSettings } from "#/features/settings/meeting-settings.tsx";

export const Route = createFileRoute("/_app/settings/meetings")({ component: MeetingSettings });
