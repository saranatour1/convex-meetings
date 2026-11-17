import { track } from "@databuddy/sdk";
import { useMutation, useQuery } from "convex/react";
import { PhoneIcon, PhoneOffIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Button } from "@meetings/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@meetings/ui/components/dialog";
import { showError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";

export const IncomingCall = ({ onAnswered }: { onAnswered: (code: string) => void }) => {
  const ring = useQuery(api.rings.incoming);
  const answer = useMutation(api.rings.answer);
  if (!ring) return null;
  const reply = (accept: boolean) =>
    void answer({ ringId: ring._id, accept })
      .then(({ code }) => {
        track("call_answered", { accept });
        if (accept) onAnswered(code);
      })
      .catch(showError);

  return (
    <Dialog key={ring._id} open onOpenChange={(open) => !open && reply(false)}>
      <DialogPopup showCloseButton={false} className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <Avatar className="size-16 animate-pulse">
            {ring.callerImageUrl && <AvatarImage src={ring.callerImageUrl} alt="" />}
            <AvatarFallback className="text-lg">{getInitials(ring.callerName)}</AvatarFallback>
          </Avatar>
          <DialogTitle>{ring.callerName} is calling</DialogTitle>
          <DialogDescription>Answer to join them in a call now.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-center sm:justify-center">
          <Button variant="destructive-outline" onClick={() => reply(false)}>
            <PhoneOffIcon />
            Decline
          </Button>
          <Button autoFocus onClick={() => reply(true)}>
            <PhoneIcon />
            Answer
          </Button>
        </DialogFooter>
        <audio src="/ring.wav" autoPlay loop />
      </DialogPopup>
    </Dialog>
  );
};
