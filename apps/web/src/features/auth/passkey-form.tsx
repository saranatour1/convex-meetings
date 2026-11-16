import { useForm } from "@tanstack/react-form";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { KeyRoundIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { describeAuthError } from "./auth-errors.ts";
import { authenticateWithPasskey } from "./webauthn.ts";
import { FormError } from "#/components/form-error.tsx";

export const PasskeyForm = () => {
  const { setSession } = useAuthActions();
  const start = useMutation(api.auth.startAutofillSignInWithUsernamePasskey);
  const finish = useMutation(api.passkeys.finishSignIn);
  const form = useForm({
    validators: {
      onSubmitAsync: async () => {
        const { options } = await start({});
        const assertion = await authenticateWithPasskey(options);
        if ("error" in assertion) return describeAuthError(assertion.error);
        const result = await finish({ response: assertion.response });
        if (result.status === "error") return describeAuthError(result.userError.error);
        await setSession(result.tokens);
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
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
            <KeyRoundIcon />
            {isSubmitting ? "Waiting for your passkey…" : "Sign in with a passkey"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
