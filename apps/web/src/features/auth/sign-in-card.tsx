import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Logo } from "#/components/logo.tsx";
import { DevEmailForm } from "./dev-email-form.tsx";
import { OAuthButtons } from "./oauth-buttons.tsx";

export const SignInCard = () => {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <Logo className="mb-2 size-9" />
        <CardTitle>Sign in to Meetings</CardTitle>
        <CardDescription>
          Continue with Google or GitHub, then confirm it's you with your passkey. New here? The
          same buttons create your account.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-2">
        <OAuthButtons />
        <DevEmailForm />
      </CardPanel>
    </Card>
  );
};
