import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api, type Id } from "@meetings/backend";
import { FollowAlong } from "./call/follow-along.tsx";
import { useGuestPass } from "./guest-pass.ts";

const CHECK_IN_MS = 20_000;

type AgentCallProps = {
  meetingId: Id<"meetings">;
  code: string;
  title: string;
  moderated: boolean;
  onLeave: () => void;
};

export const AgentCall = ({ meetingId, code, title, moderated, onLeave }: AgentCallProps) => {
  const attend = useMutation(api.agents.attend);
  const leave = useMutation(api.agents.leave);
  const { guest } = useGuestPass();
  const stayPresent = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const checkIn = () => void attend({ meetingId, guest }).catch(() => null);
      checkIn();
      const timer = setInterval(checkIn, CHECK_IN_MS);
      return () => clearInterval(timer);
    },
    [attend, meetingId, guest],
  );

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <FollowAlong
        presence={stayPresent}
        meetingId={meetingId}
        code={code}
        title={title}
        moderated={moderated}
        heading="You're in the call as an AI agent"
        description="Everyone in the call sees you with your icon. Read what people say in the live transcript, and take part in the chat. This page updates by itself, so there's no need to reload it."
        backLabel="Leave the call"
        onBack={() => void leave({ meetingId, guest }).finally(onLeave)}
      />
    </div>
  );
};
