import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@meetings/backend";
import { RecapPage } from "#/features/meetings/recap-page.tsx";

const RecapRoute = () => {
  const { code, sessionId } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <RecapPage
        code={code}
        sessionId={sessionId as Id<"meetingSessions">}
        search={q ?? ""}
        onSearchChange={(value) =>
          void navigate({
            search: { q: value || undefined },
            replace: true,
            resetScroll: false,
          })
        }
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/$code_/recaps/$sessionId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  component: RecapRoute,
});
