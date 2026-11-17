import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { api } from "@meetings/backend";
import type { Room } from "#/features/rooms/room-card.tsx";
import { RoomsDirectory } from "#/features/rooms/rooms-directory.tsx";
import { PublicShell } from "#/layouts/public-shell/public-shell.tsx";
import { SITE_URL, pageHead } from "#/lib/seo.ts";
import { convexHttp } from "#/providers/convex.tsx";

const RoomsRoute = () => {
  const initial = Route.useLoaderData();
  return (
    <>
      <Authenticated>
        <Navigate to="/public-rooms" replace />
      </Authenticated>
      <PublicShell>
        <RoomsDirectory initial={initial} />
      </PublicShell>
    </>
  );
};

const page = pageHead({
  title: "Public rooms · Meetings",
  description:
    "Drop into a public room and sit with other people while you work, read or do nothing. Camera on or off, no account needed to join and chat.",
  canonicalPath: "/rooms",
});

export const Route = createFileRoute("/rooms/")({
  ssr: true,
  loader: (): Promise<Room[]> =>
    convexHttp
      .query(api.rooms.directory, { paginationOpts: { numItems: 24, cursor: null } })
      .then((result) => result.page)
      .catch(() => []),
  head: ({ loaderData }) => ({
    ...page,
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Public rooms",
          itemListElement: (loaderData ?? []).map((room, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: room.title,
            description: room.description,
            url: `${SITE_URL}/rooms/${room.code}`,
          })),
        }),
      },
    ],
  }),
  component: RoomsRoute,
});
