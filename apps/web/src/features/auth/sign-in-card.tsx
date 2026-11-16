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

export const SignInCard = ({ method }: { method: "passkey" | "password" }) => {
  const withPassword = method === "password";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to Meetings</CardTitle>
        <CardDescription>
          New here? Continue with Google or GitHub to create your account, then add a passkey.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-2">
        <OAuthButtons />
      </CardPanel>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full items-center gap-3 text-muted-foreground text-xs">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>
        <div className="w-full">{withPassword ? <PasswordForm /> : <PasskeyForm />}</div>
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
};
