import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { api } from "@meetings/backend";
import { RoomEntry, type RoomPreview } from "#/features/rooms/room-entry.tsx";
import { PublicShell } from "#/layouts/public-shell/public-shell.tsx";
import { pageHead } from "#/lib/seo.ts";
import { convexHttp } from "#/providers/convex.tsx";

const RoomRoute = () => {
  const { code } = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = Route.useNavigate();
  return (
    <>
      <Authenticated>
        <Navigate to="/meetings/$code" params={{ code }} replace />
      </Authenticated>
      <PublicShell>
        <RoomEntry
          code={code}
          initial={initial}
          onEntered={(secret) =>
            void navigate({ to: "/guest/$secret", params: { secret }, replace: true })
          }
        />
      </PublicShell>
    </>
  );
};

export const Route = createFileRoute("/rooms/$code")({
  ssr: true,
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
