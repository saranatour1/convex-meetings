import { createFileRoute } from "@tanstack/react-router";
import { InviteCard } from "#/features/orgs/invite-card.tsx";
import { pageHead } from "#/lib/seo.ts";

const InvitePage = () => {
  const { secret } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <InviteCard secret={secret} onJoined={() => void navigate({ to: "/home" })} />
    </div>
  );
};

export const Route = createFileRoute("/invite/$secret")({
  ssr: "data-only",
  head: () =>
    pageHead({
      title: "You're invited · Meetings",
      description: "Open this link to join an organization on Meetings.",
    }),
  component: InvitePage,
});
