import { track } from "@databuddy/sdk";
import { useForm } from "@tanstack/react-form";
import { useSignInWithUsernamePasskey } from "@convex-dev/auth/methods/username-passkey/react";
import { KeyRoundIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { Input } from "@meetings/ui/components/input";
import { Label } from "@meetings/ui/components/label";
import { describeAuthError } from "./auth-errors.ts";
import { FormError } from "#/components/form-error.tsx";

export const PasskeyForm = () => {
  const passkey = useSignInWithUsernamePasskey(api.auth);
  const form = useForm({
    defaultValues: { username: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result = await passkey.signIn(value);
        if (result.status === "error") return describeAuthError(result.userError.error);
        track("signed_in", { method: "passkey" });
        return undefined;
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
              autoComplete="username webauthn"
              required
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" className="w-full" disabled={isSubmitting || passkey.pending}>
            <KeyRoundIcon />
            {isSubmitting || passkey.pending
              ? "Waiting for your passkey…"
              : "Continue with passkey"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
