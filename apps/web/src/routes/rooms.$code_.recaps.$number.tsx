import { createFileRoute } from "@tanstack/react-router";
import { api } from "@meetings/backend";
import { PublicRecap, type PublicRecapData } from "#/features/rooms/public-recap.tsx";
import { PublicShell } from "#/layouts/public-shell/public-shell.tsx";
import { pageHead } from "#/lib/seo.ts";
import { convexHttp } from "#/providers/convex.tsx";

const RecapRoute = () => {
  const { code, number } = Route.useParams();
  const initial = Route.useLoaderData();
  return (
    <PublicShell>
      <PublicRecap code={code} number={number} initial={initial} />
    </PublicShell>
  );
};

export const Route = createFileRoute("/rooms/$code_/recaps/$number")({
  ssr: true,
  params: {
    parse: ({ code, number }) => ({ code, number: Math.max(1, Math.trunc(Number(number)) || 1) }),
    stringify: ({ code, number }) => ({ code, number: String(number) }),
  },
  loader: ({ params }): Promise<PublicRecapData> =>
    convexHttp
      .query(api.rooms.recap, { code: params.code, number: params.number })
      .catch(() => null),
  head: ({ loaderData, params }) =>
    loaderData
      ? pageHead({
          title: `Recap ${params.number} of ${loaderData.title} · Meetings`,
          description:
            loaderData.summary?.slice(0, 200) ??
            `A recap of the public room ${loaderData.title}: when it was open and how many people came.`,
          canonicalPath: `/rooms/${params.code}/recaps/${params.number}`,
        })
      : pageHead({ title: "Recap · Meetings", description: "A recap of a public room." }),
  component: RecapRoute,
});
