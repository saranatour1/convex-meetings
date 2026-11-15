import { useForm } from "@tanstack/react-form";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { describeAuthError } from "./auth-errors.ts";
import { FormError } from "#/components/form-error.tsx";

export function PasswordForm({ mode }: { mode: "signin" | "signup" }) {
  const signIn = useSignInWithUsernamePassword(api.auth).signIn;
  const signUp = useSignUpWithUsernamePassword(api.auth).signUp;
  const isSignUp = mode === "signup";
  const form = useForm({
    defaultValues: { username: "", password: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result = await (isSignUp ? signUp : signIn)(value);
        return result.status === "error" ? describeAuthError(result.userError.error) : undefined;
      },
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="username">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Username</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Password</Label>
            <Input
              id={field.name}
              type="password"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <Button type="submit" className="w-full" disabled={pending}>
            {isSignUp ? "Sign up" : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
