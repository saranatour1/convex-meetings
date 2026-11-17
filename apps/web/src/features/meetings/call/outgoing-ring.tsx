import { useMutation, useQuery } from "convex/react";
import { PhoneMissedIcon, PhoneOffIcon, PhoneOutgoingIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { showError } from "#/lib/errors.ts";

export const OutgoingRing = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const ring = useQuery(api.rings.outgoing, { meetingId });
  const cancel = useMutation(api.rings.cancel);
  if (!ring || ring.status === "accepted" || ring.status === "cancelled") return null;
  const ringing = ring.status === "ringing";

  return (
    <div
      role="status"
      className="absolute top-14 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover py-1 ps-3 pe-1 text-sm shadow-lg"
    >
      {ringing ? (
        <PhoneOutgoingIcon className="size-4 animate-pulse" />
      ) : (
        <PhoneMissedIcon className="size-4 text-destructive-foreground" />
      )}
      {ringing
        ? `Ringing ${ring.calleeName}…`
        : ring.status === "declined"
          ? `${ring.calleeName} declined`
          : `${ring.calleeName} didn't answer`}
      {ringing && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => void cancel({ ringId: ring._id }).catch(showError)}
        >
          <PhoneOffIcon />
          Stop ringing
        </Button>
      )}
    </div>
  );
};
