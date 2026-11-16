import { createFileRoute } from "@tanstack/react-router";
import { InviteCard } from "#/features/orgs/invite-card.tsx";

const InvitePage = () => {
  const { secret } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <InviteCard secret={secret} onJoined={() => void navigate({ to: "/" })} />
    </div>
  );
};

export const Route = createFileRoute("/invite/$secret")({ component: InvitePage });
