import { createFileRoute } from "@tanstack/react-router";
import { RoomsPage, type RoomsTab } from "#/features/rooms/rooms-page.tsx";

const PublicRoomsPage = () => {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <RoomsPage
        tab={tab ?? "browse"}
        onCreated={(code) => void navigate({ to: "/meetings/$code", params: { code } })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/public-rooms")({
  validateSearch: (search: Record<string, unknown>): { tab?: RoomsTab } => ({
    tab: search.tab === "ours" || search.tab === "moderation" ? search.tab : undefined,
  }),
  component: PublicRoomsPage,
});
