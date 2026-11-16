import { createFileRoute } from "@tanstack/react-router";
import { JoinLinkCard } from "#/features/orgs/join-link-card.tsx";

const JoinPage = () => {
  const { secret } = Route.useParams();
  const navigate = Route.useNavigate();

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <JoinLinkCard secret={secret} onJoined={() => void navigate({ to: "/" })} />
    </div>
  );
};

export const Route = createFileRoute("/join/$secret")({ component: JoinPage });
