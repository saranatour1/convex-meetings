import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery } from "convex/react";
import { SendIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { FormError } from "#/components/form-error.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { formatTime } from "#/lib/schedule.ts";
import { useGuestPass } from "./guest-pass.ts";

type MeetingChatProps = { meetingId: Id<"meetings">; since?: number };

export const MeetingChat = ({ meetingId, since }: MeetingChatProps) => {
  const pass = useGuestPass();
  const messages = usePaginatedQuery(
    api.messages.list,
    { meetingId, ...pass },
    { initialNumItems: 50 },
  );
  const send = useMutation(api.messages.send);
  const zone = browserTimeZone();
  const form = useForm({
    defaultValues: { body: "" },
    validators: {
      onSubmitAsync: async ({ value, formApi }) => {
        try {
          await send({ meetingId, body: value.body, ...pass });
          formApi.reset();
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex max-h-80 flex-col-reverse gap-3 overflow-y-auto">
        {messages.results.map((message, index) => {
          const newer = messages.results[index - 1];
          const firstEarlier =
            since !== undefined &&
            message._creationTime < since &&
            (newer === undefined || newer._creationTime >= since);
          return (
            <li key={message._id} className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {message.authorName} · {formatTime(message._creationTime, zone)}
              </span>
              <span className="whitespace-pre-wrap text-sm">{message.body}</span>
              {firstEarlier && (
                <span className="mt-3 flex items-center gap-2 text-muted-foreground text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  This call
                </span>
              )}
            </li>
          );
        })}
        {messages.status === "CanLoadMore" && (
          <li>
            <Button size="sm" variant="ghost" onClick={() => messages.loadMore(50)}>
              Earlier messages
            </Button>
          </li>
        )}
      </ol>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="body">
          {(field) => (
            <Input
              aria-label="Message"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Write to everyone in this meeting"
              maxLength={4000}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => [!state.values.body.trim(), state.isSubmitting]}>
          {([empty, isSubmitting]) => (
            <Button type="submit" size="icon" aria-label="Send" disabled={empty || isSubmitting}>
              <SendIcon />
            </Button>
          )}
        </form.Subscribe>
      </form>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </div>
  );
};
