import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { LinkIcon } from "lucide-react";
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

type JoinLinkCardProps = {
  secret: string;
  onJoined: (orgId: Id<"organizations">) => void;
};

const JoinButton = ({ secret, onJoined }: JoinLinkCardProps) => {
  const accept = useMutation(api.joinLinks.accept);
  const reportTimeZone = useMutation(api.users.reportTimeZone);
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const orgId = await accept({ secret });
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
            {isSubmitting ? "Joining…" : "Join"}
          </Button>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(error) => <FormError error={error} />}
      </form.Subscribe>
    </div>
  );
};

export const JoinLinkCard = ({ secret, onJoined }: JoinLinkCardProps) => {
  const link = useQuery(api.joinLinks.preview, { secret });
  if (link === undefined) return <LoadingScreen />;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="size-4" />
          {link ? `Join ${link.orgName}` : "This link doesn't work anymore"}
        </CardTitle>
        <CardDescription>
          {link
            ? `You'll join as ${link.roleName ?? "a member"}.`
            : "It expired, was turned off or has been used up. Ask for a new one."}
        </CardDescription>
      </CardHeader>
      {link && (
        <CardFooter>
          <AuthLoading>
            <Button className="w-full" disabled>
              Checking your session…
            </Button>
          </AuthLoading>
          <Unauthenticated>
            <Button
              className="w-full"
              render={<Link to="/sign-in" search={{ redirect: `/join/${secret}` }} />}
            >
              Sign in or create an account to join
            </Button>
          </Unauthenticated>
          <Authenticated>
            <JoinButton secret={secret} onJoined={onJoined} />
          </Authenticated>
        </CardFooter>
      )}
    </Card>
  );
};
