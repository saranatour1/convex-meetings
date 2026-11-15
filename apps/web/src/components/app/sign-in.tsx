import { useState } from "react";
import { KeyRoundIcon } from "lucide-react";
import { useSignInWithUsernamePasskey } from "@convex-dev/auth/methods/username-passkey/react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { useSignInWithGithub } from "@convex-dev/auth/methods/github/react";
import { api } from "@meetings/backend/api";
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
import { Separator } from "@meetings/ui/components/separator";

const messages: Record<string, string> = {
  USER_NOT_FOUND: "No account with that username.",
  INVALID_CREDENTIALS: "Wrong password.",
  USERNAME_TAKEN: "That username is taken.",
  RATE_LIMITED: "Too many attempts. Try again shortly.",
  CEREMONY_ABORTED: "Passkey prompt was cancelled.",
  WEBAUTHN_UNSUPPORTED: "This browser does not support passkeys.",
};
const describe = (code: string) => messages[code] ?? code.replaceAll("_", " ").toLowerCase();

export function SignIn() {
  const passkey = useSignInWithUsernamePasskey(api.auth);
  const passwordSignIn = useSignInWithUsernamePassword(api.auth);
  const passwordSignUp = useSignUpWithUsernamePassword(api.auth);
  const google = useSignInWithGoogle(api.auth);
  const github = useSignInWithGithub(api.auth);
  const { flowError } = useOauth();

  const [usePassword, setUsePassword] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = passkey.pending || passwordSignIn.pending || passwordSignUp.pending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = !usePassword
      ? await passkey.signIn({ username })
      : await (signUp ? passwordSignUp.signUp : passwordSignIn.signIn)({ username, password });
    if (result.status === "error") setError(describe(result.userError.error));
  }

  const shownError = error ?? (flowError ? describe(flowError.error) : null);

  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Meetings</CardTitle>
          <CardDescription>
            {usePassword
              ? "Use your username and password."
              : "Enter a username. New usernames create an account with a passkey."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} className="contents">
          <CardPanel className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete={usePassword ? "username" : "username webauthn"}
                required
              />
            </div>
            {usePassword && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signUp ? "new-password" : "current-password"}
                  required
                />
              </div>
            )}
            {shownError && (
              <p className="text-destructive-foreground text-sm" role="alert">
                {shownError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {usePassword ? (
                signUp ? (
                  "Sign up"
                ) : (
                  "Sign in"
                )
              ) : (
                <>
                  <KeyRoundIcon />
                  {pending ? "Waiting for your passkey…" : "Continue with passkey"}
                </>
              )}
            </Button>
            {usePassword && (
              <Button type="button" variant="link" onClick={() => setSignUp(!signUp)}>
                {signUp ? "Have an account? Sign in" : "No account? Sign up"}
              </Button>
            )}
          </CardPanel>
        </form>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex w-full items-center gap-3 text-muted-foreground text-xs">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => void google.signIn()}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => void github.signIn()}
          >
            <GithubIcon />
            Continue with GitHub
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setUsePassword(!usePassword);
              setError(null);
            }}
          >
            {usePassword ? "Use a passkey instead" : "Use a password instead"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}
