import { track } from "@databuddy/sdk";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "@meetings/backend";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@meetings/ui/components/alert-dialog";
import { Button } from "@meetings/ui/components/button";
import { FormError } from "#/components/form-error.tsx";
import { describeError, showError } from "#/lib/errors.ts";

export const CancelMeetingDialog = ({
  code,
  onClose,
  onCancelled,
}: {
  code: string | undefined;
  onClose: () => void;
  onCancelled: () => void;
}) => {
  const meeting = useQuery(api.meetings.get, code ? { code } : "skip");
  const cancel = useMutation(api.meetings.cancel);
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        if (!meeting) return undefined;
        try {
          await cancel({ meetingId: meeting._id });
          track("meeting_cancelled");
          onCancelled();
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <AlertDialog open={Boolean(code)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {meeting?.title ?? "this meeting"}?</AlertDialogTitle>
          <AlertDialogDescription>
            It comes off everyone's calendar and invitees are told it's cancelled. This can't be
            undone.
          </AlertDialogDescription>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Keep it</AlertDialogClose>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                variant="destructive"
                disabled={isSubmitting || !meeting}
                onClick={() => void form.handleSubmit().catch(showError)}
              >
                Cancel meeting
              </Button>
            )}
          </form.Subscribe>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
};
