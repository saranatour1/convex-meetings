import { track } from "@databuddy/sdk";
import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { KeyRoundIcon } from "lucide-react";
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
import { describeAuthError } from "./auth-errors.ts";
import { authenticateWithPasskey, createPasskey } from "./webauthn.ts";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";

const copy = {
  enroll: {
    title: "Add a passkey",
    description:
      "Your account needs a passkey. Each time you sign in with Google or GitHub, you'll confirm it's you with it.",
    action: "Add a passkey",
  },
  verify: {
    title: "Confirm it's you",
    description: "Use your passkey to finish signing in.",
    action: "Use my passkey",
  },
};

const OAuthRequiredCard = () => {
  const { signOut } = useAuthActions();

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in with Google or GitHub</CardTitle>
          <CardDescription>
            This account was made with a username, which Meetings no longer supports. Sign out, then
            continue with Google or GitHub.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

const PasskeyStepCard = ({ step }: { step: "enroll" | "verify" }) => {
  const { signOut } = useAuthActions();
  const start = useMutation(api.passkeys.start);
  const finishEnroll = useMutation(api.passkeys.finishEnroll);
  const finishVerify = useMutation(api.passkeys.finishVerify);
  const form = useForm({
    validators: {
      onSubmitAsync: async () => {
        const started = await start({});
        if (started.step === "enroll") {
          const created = await createPasskey(started.options);
          if ("error" in created) return describeAuthError(created.error);
          const { error } = await finishEnroll({ response: created.response });
          if (error) return describeAuthError(error);
          track("passkey_added");
          return undefined;
        }
        const asserted = await authenticateWithPasskey(started.options);
        if ("error" in asserted) return describeAuthError(asserted.error);
        const { error } = await finishVerify({ response: asserted.response });
        if (error) return describeAuthError(error);
        track("signed_in", { method: "oauth" });
        return undefined;
      },
    },
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{copy[step].title}</CardTitle>
          <CardDescription>{copy[step].description}</CardDescription>
        </CardHeader>
        <CardPanel>
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <KeyRoundIcon />
                  {isSubmitting ? "Waiting for your passkey…" : copy[step].action}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardPanel>
        <CardFooter>
          <Button variant="link" size="sm" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export const PasskeyGate = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useConvexAuth();
  const step = useQuery(api.passkeys.step, isAuthenticated ? {} : "skip");
  if (!isAuthenticated) return children;
  if (step === undefined) return <LoadingScreen />;
  if (step === "oauth") return <OAuthRequiredCard />;
  if (step === "enroll" || step === "verify") return <PasskeyStepCard key={step} step={step} />;
  return children;
};
