import { track } from "@databuddy/sdk";
import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { AuthLoading, Authenticated, Unauthenticated, useMutation } from "convex/react";
import { MailOpenIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@meetings/ui/components/card";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

type InviteCardProps = {
  secret: string;
  onJoined: (orgId: Id<"organizations">) => void;
};

const AcceptButton = ({ secret, onJoined }: InviteCardProps) => {
  const accept = useMutation(api.invites.accept);
  const reportTimeZone = useMutation(api.users.reportTimeZone);
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const orgId = await accept({ secret });
          track("organization_joined", { via: "invite" });
          await reportTimeZone({ timeZone: browserTimeZone() });
          onJoined(orgId);
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  return (
    <div className="flex w-full flex-col gap-2">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={() => void form.handleSubmit()}
          >
            {isSubmitting ? "Joining…" : "Accept invite"}
          </Button>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </div>
  );
};

export const InviteCard = ({ secret, onJoined }: InviteCardProps) => {
  const invite = useConvexValue(api.invites.preview, { secret });
  if (invite === undefined) return <LoadingScreen />;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailOpenIcon className="size-4" />
          {invite ? `Join ${invite.orgName}` : "This invite doesn't work anymore"}
        </CardTitle>
        <CardDescription>
          {invite
            ? `${invite.inviterName} invited ${invite.email}. Accepting confirms that address is yours.`
            : "It expired or was already used. Ask whoever invited you to send a new one."}
        </CardDescription>
      </CardHeader>
      {invite && (
        <CardFooter>
          <AuthLoading>
            <Button className="w-full" disabled>
              Checking your session…
            </Button>
          </AuthLoading>
          <Unauthenticated>
            <Button
              className="w-full"
              render={<Link to="/sign-in" search={{ redirect: `/invite/${secret}` }} />}
            >
              Sign in or create an account to join
            </Button>
          </Unauthenticated>
          <Authenticated>
            <AcceptButton secret={secret} onJoined={onJoined} />
          </Authenticated>
        </CardFooter>
      )}
    </Card>
  );
};
