import { createFileRoute } from "@tanstack/react-router";
import { PEN_COLORS, type PenColor } from "#/features/meetings/call/annotations.tsx";
import type { CallSide } from "#/features/meetings/call/call-ui.ts";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";

const SIDES: CallSide[] = ["chat", "participants", "polls", "plugins", "ai"];

type MeetingSearch = { call?: true; side?: CallSide; expand?: true; draw?: PenColor };

const MeetingRoute = () => {
  const { code } = Route.useParams();
  const { call, side, expand } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: MeetingSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <MeetingPage
        code={code}
        onCancelled={() => void navigate({ to: "/" })}
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
  validateSearch: (search: Record<string, unknown>): MeetingSearch => ({
    call: search.call === true || search.call === "true" ? true : undefined,
    side: SIDES.find((s) => s === search.side),
    expand: search.expand === true || search.expand === "true" ? true : undefined,
    draw: PEN_COLORS.find((color) => color === search.draw),
  }),
  component: MeetingRoute,
});
