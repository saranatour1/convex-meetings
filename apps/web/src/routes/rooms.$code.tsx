import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { api } from "@meetings/backend";
import { MeetingPage } from "#/features/meetings/meeting-page.tsx";
import { type MeetingSearch, validateMeetingSearch } from "#/features/meetings/meeting-search.ts";
import { RoomEntry, type RoomPreview } from "#/features/rooms/room-entry.tsx";
import { PublicShell } from "#/layouts/public-shell/public-shell.tsx";
import { pageHead } from "#/lib/seo.ts";
import { convexHttp } from "#/providers/convex.tsx";

const RoomRoute = () => {
  const { code } = Route.useParams();
  const initial = Route.useLoaderData();
  const { call, side, expand, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (next: MeetingSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });
  const entry = (
    <RoomEntry
      code={code}
      initial={initial}
      onEntered={(secret) =>
        void navigate({ to: "/guest/$secret", params: { secret }, replace: true })
      }
    />
  );

  return (
    <PublicShell>
      <AuthLoading>{entry}</AuthLoading>
      <Unauthenticated>{entry}</Unauthenticated>
      <Authenticated>
        <div className="mx-auto w-full max-w-5xl">
          <MeetingPage
            code={code}
            onCancelled={() => void navigate({ to: "/rooms" })}
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
            tab={tab}
            onTabChange={(next) => setSearch({ tab: next })}
          />
        </div>
      </Authenticated>
    </PublicShell>
  );
};

export const Route = createFileRoute("/rooms/$code")({
  ssr: true,
  validateSearch: validateMeetingSearch,
  loader: ({ params }): Promise<RoomPreview> =>
    convexHttp.query(api.rooms.preview, { code: params.code }).catch(() => null),
  head: ({ loaderData, params }) =>
    loaderData
      ? pageHead({
          title: `${loaderData.title} · Public room · Meetings`,
          description: loaderData.description,
          canonicalPath: `/rooms/${params.code}`,
        })
      : pageHead({
          title: "Public room · Meetings",
          description: "A public room on Meetings.",
        }),
  component: RoomRoute,
});
