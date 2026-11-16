import { track } from "@databuddy/sdk";
import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { useSignInWithGithub } from "@convex-dev/auth/methods/github/react";
import { api } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { FormError } from "#/components/form-error.tsx";
import { describeAuthError } from "./auth-errors.ts";
import { GithubIcon, GoogleIcon } from "./provider-icons.tsx";

export const OAuthButtons = () => {
  const google = useSignInWithGoogle(api.auth);
  const github = useSignInWithGithub(api.auth);
  const { flowError } = useOauth();

  return (
    <>
      <FormError error={flowError ? describeAuthError(flowError.error) : undefined} />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          track("sign_in_started", { method: "google" });
          void google.signIn();
        }}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          track("sign_in_started", { method: "github" });
          void github.signIn();
        }}
      >
        <GithubIcon />
        Continue with GitHub
      </Button>
    </>
  );
};
