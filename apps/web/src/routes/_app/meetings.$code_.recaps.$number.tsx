import { createFileRoute } from "@tanstack/react-router";
import { RecapPage } from "#/features/meetings/recap-page.tsx";

const RecapRoute = () => {
  const { code, number } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <RecapPage
        code={code}
        number={number}
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

export const Route = createFileRoute("/_app/meetings/$code_/recaps/$number")({
  params: {
    parse: ({ code, number }) => ({ code, number: Math.max(1, Math.trunc(Number(number)) || 1) }),
    stringify: ({ code, number }) => ({ code, number: String(number) }),
  },
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  component: RecapRoute,
});
