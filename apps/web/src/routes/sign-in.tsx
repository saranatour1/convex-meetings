import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { SignInCard } from "#/features/auth/sign-in-card.tsx";

type SignInSearch = { redirect?: string };

const isLocalPath = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const SignInPage = () => {
  const search = Route.useSearch();

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Authenticated>
        <Navigate to={(search.redirect ?? "/") as "/"} replace />
      </Authenticated>
      <Unauthenticated>
        <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
          <SignInCard />
        </div>
      </Unauthenticated>
    </>
  );
};

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect: isLocalPath(search.redirect) ? search.redirect : undefined,
  }),
  component: SignInPage,
});
