import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { DoorOpenIcon, LockIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { describeError } from "#/lib/errors.ts";
import { kindOf } from "./meeting-kinds.ts";

type GuestEntryProps = { code: string; onEntered: (secret: string) => void };

export const GuestEntry = ({ code, onEntered }: GuestEntryProps) => {
  const preview = useQuery(api.guests.preview, { code });
  const enter = useMutation(api.guests.enter);
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        try {
          onEntered(await enter({ code, name: value.name }));
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });
  if (preview === undefined) return <LoadingScreen />;
  const signIn = (
    <Button
      variant="outline"
      className="w-full"
      render={<Link to="/sign-in" search={{ redirect: `/meetings/${code}` }} />}
    >
      Sign in
    </Button>
  );

  if (preview === null || preview.access !== "link") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-4" />
            {preview ? "This meeting is invite only" : "No meeting with that code"}
          </CardTitle>
          <CardDescription>
            {preview
              ? "Sign in if you were invited, or open the personal link from your invite email."
              : "Check the link, or ask whoever sent it for a new one."}
          </CardDescription>
        </CardHeader>
        {preview && <CardFooter>{signIn}</CardFooter>}
      </Card>
    );
  }

  return (
    <form
      className="w-full max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{preview.title}</CardTitle>
          <CardDescription>
            {kindOf(preview.kind).label}. Join from your browser, no account needed.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="guest-name">Your name</Label>
                <Input
                  id="guest-name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
        </CardPanel>
        <CardFooter className="flex flex-col gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <DoorOpenIcon />
                {isSubmitting ? "Joining…" : "Join as a guest"}
              </Button>
            )}
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) => <FormError error={error} />}
          </form.Subscribe>
          {signIn}
        </CardFooter>
      </Card>
    </form>
  );
};
