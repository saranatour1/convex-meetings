import { createFileRoute } from "@tanstack/react-router";
import { type CallSearch, validateCallSearch } from "#/features/meetings/call/call-search.ts";
import { GuestMeeting } from "#/features/meetings/guest-meeting.tsx";
import { pageHead } from "#/lib/seo.ts";

const GuestPage = () => {
  const { secret } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="min-h-dvh bg-background">
      <GuestMeeting
        secret={secret}
        search={search}
        onSearchChange={(next: CallSearch) =>
          void navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
            resetScroll: false,
          })
        }
      />
    </main>
  );
};

export const Route = createFileRoute("/guest/$secret")({
  validateSearch: validateCallSearch,
  ssr: "data-only",
  head: () =>
    pageHead({
      title: "Meeting · Meetings",
      description: "Your guest pass to a meeting on Meetings.",
    }),
  component: GuestPage,
});
