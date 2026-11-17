import { createFileRoute } from "@tanstack/react-router";
import { JoinLinkCard } from "#/features/orgs/join-link-card.tsx";
import { pageHead } from "#/lib/seo.ts";

const JoinPage = () => {
  const { secret } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <JoinLinkCard secret={secret} onJoined={() => void navigate({ to: "/home" })} />
    </div>
  );
};

export const Route = createFileRoute("/join/$secret")({
  ssr: "data-only",
  head: () =>
    pageHead({
      title: "Join an organization · Meetings",
      description: "Open this link to join an organization on Meetings.",
    }),
  component: JoinPage,
});
