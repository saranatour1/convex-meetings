import { track } from "@databuddy/sdk";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { PlusIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { Textarea } from "@meetings/ui/components/textarea";
import { FormError } from "#/components/form-error.tsx";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { SlowModeSelect } from "./slow-mode.tsx";

export const NewRoomForm = ({ onCreated }: { onCreated: (code: string) => void }) => {
  const { orgId, name } = useActiveOrg();
  const create = useMutation(api.rooms.create);
  const form = useForm({
    defaultValues: { title: "", description: "", slowModeSeconds: 30 },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          const { code } = await create({ orgId, ...value, timeZone: browserTimeZone() });
          track("room_created", { slowMode: value.slowModeSeconds });
          onCreated(code);
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open a public room</CardTitle>
        <CardDescription>
          Anyone on the internet can find it, join and chat. It is listed as hosted by {name} and
          stays open until you close it.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="title">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="room-title">Name</Label>
                <Input
                  id="room-title"
                  maxLength={200}
                  required
                  placeholder="Quiet study hall"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="room-description">Description</Label>
                <Textarea
                  id="room-description"
                  rows={2}
                  maxLength={500}
                  required
                  placeholder="Bring your work and sit with us. Cameras optional."
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <span className="text-muted-foreground text-xs">
                  Shown on the public page and to search engines.
                </span>
              </div>
            )}
          </form.Field>
          <form.Field name="slowModeSeconds">
            {(field) => (
              <div className="flex max-w-xs flex-col gap-2">
                <Label htmlFor="room-slow-mode">Slow mode in chat</Label>
                <SlowModeSelect
                  id="room-slow-mode"
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="self-start" disabled={isSubmitting}>
                <PlusIcon />
                {isSubmitting ? "Opening…" : "Open room"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardPanel>
    </Card>
  );
};
