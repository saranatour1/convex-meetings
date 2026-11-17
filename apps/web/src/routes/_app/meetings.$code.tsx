import { createFileRoute } from "@tanstack/react-router";
import { type CallSearch, validateCallSearch } from "#/features/meetings/call/call-search.ts";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";

const MeetingRoute = () => {
  const { code } = Route.useParams();
  const { call, side, expand } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: CallSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <MeetingPage
        code={code}
        onCancelled={() => void navigate({ to: "/home" })}
        inCall={call === true}
        onInCallChange={(inCall) =>
          setSearch({
            call: inCall || undefined,
            side: undefined,
            expand: undefined,
            draw: undefined,
          })
        }
        side={side}
        onSideChange={(next) => setSearch({ side: next })}
        expanded={expand === true}
        onExpandedChange={(next) => setSearch({ expand: next || undefined })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/$code")({
  validateSearch: validateCallSearch,
  component: MeetingRoute,
});
