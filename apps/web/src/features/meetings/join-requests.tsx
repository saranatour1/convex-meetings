import { track } from "@databuddy/sdk";
import { useMutation } from "convex/react";
import { CheckIcon, XIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Button } from "@meetings/ui/components/button";
import { cn } from "@meetings/ui/lib/utils";
import { showError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { useConvexPages } from "#/features/data/live-query.ts";

type JoinRequestsProps = { meetingId: Id<"meetings">; className?: string };

export const JoinRequests = ({ meetingId, className }: JoinRequestsProps) => {
  const { results, status, loadMore } = useConvexPages(
    api.joinRequests.waiting,
    { meetingId },
    { initialNumItems: 5 },
  );
  const admit = useMutation(api.joinRequests.admit);
  const deny = useMutation(api.joinRequests.deny);
  if (!results.length) return null;
  const answer = (requestId: Id<"joinRequests">, letIn: boolean) =>
    void (letIn ? admit : deny)({ requestId })
      .then(() => track("join_request_answered", { admit: letIn }))
      .catch(showError);

  return (
    <section
      aria-label="People asking to join"
      className={cn("flex flex-col gap-2 bg-info/8 text-sm", className)}
    >
      {results.map((request) => (
        <div key={request._id} className="flex flex-wrap items-center gap-2">
          <Avatar className="size-7">
            {request.imageUrl && <AvatarImage src={request.imageUrl} alt="" />}
            <AvatarFallback className="text-xs">{getInitials(request.name)}</AvatarFallback>
          </Avatar>
          <span className="me-auto">
            <span className="font-medium">{request.name}</span>
            {request.isGuest && " (guest)"} asks to join
          </span>
          <Button size="xs" variant="outline" onClick={() => answer(request._id, false)}>
            <XIcon />
            Deny
          </Button>
          <Button size="xs" onClick={() => answer(request._id, true)}>
            <CheckIcon />
            Let in
          </Button>
        </div>
      ))}
      {status === "CanLoadMore" && (
        <Button size="xs" variant="ghost" className="self-start" onClick={() => loadMore(5)}>
          Show more
        </Button>
      )}
    </section>
  );
};
