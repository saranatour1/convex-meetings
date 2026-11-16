import { createFileRoute } from "@tanstack/react-router";
import { MeetingsList, type MeetingsTab } from "#/features/meetings/meetings-list.tsx";

const MeetingsPage = () => {
  const { tab } = Route.useSearch();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <MeetingsList tab={tab ?? "upcoming"} />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/")({
  validateSearch: (search: Record<string, unknown>): { tab?: MeetingsTab } => ({
    tab: search.tab === "past" ? "past" : undefined,
  }),
  component: MeetingsPage,
});
