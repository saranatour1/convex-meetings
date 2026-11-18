import { createFileRoute } from "@tanstack/react-router";
import { api } from "@meetings/backend";
import { SITE_URL } from "#/lib/seo.ts";
import { convexHttp } from "#/providers/convex.tsx";

const PAGES = ["/", "/sign-in", "/rooms", "/llms.txt"];

const openRoomPaths = async (cursor: string | null = null): Promise<string[]> => {
  const { page, isDone, continueCursor } = await convexHttp.query(api.rooms.directory, {
    paginationOpts: { numItems: 100, cursor },
  });
  const paths = page.map((room) => `/rooms/${room.code}`);
  return isDone ? paths : [...paths, ...(await openRoomPaths(continueCursor))];
};

const sitemap = (paths: string[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemap([...PAGES, ...(await openRoomPaths().catch(() => []))]), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
