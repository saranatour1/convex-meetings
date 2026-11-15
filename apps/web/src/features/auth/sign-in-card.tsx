import { Link } from "@tanstack/react-router";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Separator } from "@meetings/ui/components/separator";
import { OAuthButtons } from "./oauth-buttons.tsx";
import { PasskeyForm } from "./passkey-form.tsx";
import { PasswordForm } from "./password-form.tsx";

type SignInCardProps = { method: "passkey" | "password"; mode: "signin" | "signup" };

export function SignInCard({ method, mode }: SignInCardProps) {
  const withPassword = method === "password";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to Meetings</CardTitle>
        <CardDescription>
          {withPassword
            ? "Use your username and password."
            : "Enter a username. New usernames create an account with a passkey."}
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-2">
        {withPassword ? <PasswordForm key={mode} mode={mode} /> : <PasskeyForm />}
        {withPassword && (
          <Button
            variant="link"
            render={
              <Link
                to="/sign-in"
                search={{ with: "password", mode: mode === "signup" ? undefined : "signup" }}
              />
            }
          >
            {mode === "signup" ? "Have an account? Sign in" : "No account? Sign up"}
          </Button>
        )}
      </CardPanel>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full items-center gap-3 text-muted-foreground text-xs">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>
        <OAuthButtons />
        <Button
          variant="link"
          size="sm"
          render={<Link to="/sign-in" search={withPassword ? {} : { with: "password" }} />}
        >
          {withPassword ? "Use a passkey instead" : "Use a password instead"}
        </Button>
      </CardFooter>
    </Card>
  );
}
