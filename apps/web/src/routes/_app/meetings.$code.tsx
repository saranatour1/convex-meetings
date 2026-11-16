import { createFileRoute } from "@tanstack/react-router";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";

type MeetingSearch = { call?: true; chat?: true };

const MeetingRoute = () => {
  const { code } = Route.useParams();
  const { call, chat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: MeetingSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <MeetingPage
        code={code}
        onCancelled={() => void navigate({ to: "/" })}
        inCall={call === true}
        onInCallChange={(inCall) => setSearch({ call: inCall || undefined, chat: undefined })}
        chatOpen={chat === true}
        onChatOpenChange={(open) => setSearch({ chat: open || undefined })}
      />
    </main>
  );
};

export const Route = createFileRoute("/_app/meetings/$code")({
  validateSearch: (search: Record<string, unknown>): MeetingSearch => ({
    call: search.call === true || search.call === "true" ? true : undefined,
    chat: search.chat === true || search.chat === "true" ? true : undefined,
  }),
  component: MeetingRoute,
});
