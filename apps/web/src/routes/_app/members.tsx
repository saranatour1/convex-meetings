import { createFileRoute } from "@tanstack/react-router";
import { MembersPanel, type MemberConfirm } from "#/features/orgs/members-panel.tsx";

type MembersSearch = { q?: string; confirm?: string };

const parseConfirm = (value: string | undefined): MemberConfirm | undefined => {
  const [action, memberId] = (value ?? "").split(":");
  return (action === "remove" || action === "leave" || action === "signOut") && memberId
    ? { action, memberId }
    : undefined;
};

const MembersPage = () => {
  const { q, confirm } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: MembersSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <MembersPanel
        search={q ?? ""}
        onSearchChange={(value) => setSearch({ q: value || undefined })}
        confirm={parseConfirm(confirm)}
        onConfirmChange={(next) =>
          setSearch({ confirm: next ? `${next.action}:${next.memberId}` : undefined })
        }
        onLeft={() => void navigate({ to: "/", search: { org: undefined } })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/members")({
  validateSearch: (search: Record<string, unknown>): MembersSearch => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    confirm: typeof search.confirm === "string" ? search.confirm : undefined,
  }),
  component: MembersPage,
});
