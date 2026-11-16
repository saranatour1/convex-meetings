import { useForm } from "@tanstack/react-form";
import { useAction } from "convex/react";
import { RealtimeKitProvider, useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import { VideoIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";

export const MeetingCall = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const join = useAction(api.meetings.join);
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const { token } = await join({ meetingId });
          await initMeeting({ authToken: token });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  if (meeting) {
    return (
      <div className="h-[75dvh] overflow-hidden rounded-xl border">
        <RealtimeKitProvider value={meeting}>
          <RtkMeeting meeting={meeting} mode="fill" showSetupScreen />
        </RealtimeKitProvider>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button disabled={isSubmitting} onClick={() => void form.handleSubmit()}>
            <VideoIcon />
            {isSubmitting ? "Joining…" : "Join"}
          </Button>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </div>
  );
};
