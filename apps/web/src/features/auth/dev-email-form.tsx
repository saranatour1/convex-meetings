import { useForm } from "@tanstack/react-form";

import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { MailIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { Separator } from "@meetings/ui/components/separator";
import { FormError } from "#/components/form-error.tsx";
import { describeError } from "#/lib/errors.ts";
import { describeAuthError } from "./auth-errors.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

type Mode = "signIn" | "signUp";

export const DevEmailForm = () => {
  const enabled = useConvexValue(api.auth.devEmailSignIn, {});
  const { signIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp } = useSignUpWithUsernamePassword(api.auth);
  const form = useForm({
    defaultValues: { email: "", password: "", mode: "signIn" as Mode },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const credentials = {
          username: value.email.trim().toLowerCase(),
          password: value.password,
        };
        const result =
          value.mode === "signUp" ? await signUp(credentials) : await signIn(credentials);
        if (result.status === "complete") return undefined;
        const { userError } = result;
        return userError.error === "OTHER_ERROR"
          ? describeError(userError.cause)
          : describeAuthError(userError.error);
      },
    },
  });
  if (!enabled) return null;
  const submit = (mode: Mode) => {
    form.setFieldValue("mode", mode);
    void form.handleSubmit();
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit("signIn");
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Separator className="flex-1" />
        Development only
        <Separator className="flex-1" />
      </div>
      <form.Field name="email">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-email">Email</Label>
            <Input
              id="dev-email"
              type="email"
              autoComplete="username"
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-password">Password</Label>
            <Input
              id="dev-password"
              type="password"
              autoComplete="current-password"
              minLength={10}
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <span className="text-muted-foreground text-xs">At least 10 characters.</span>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              <MailIcon />
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => submit("signUp")}
            >
              Create account
            </Button>
          </div>
        )}
      </form.Subscribe>
      <span className="text-muted-foreground text-xs">
        Email accounts work only on this development deployment. Nothing is emailed and there is no
        passkey step.
      </span>
    </form>
  );
};
