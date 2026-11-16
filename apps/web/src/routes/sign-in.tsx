import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { SignInCard } from "#/features/auth/sign-in-card.tsx";

type SignInSearch = { with?: "password"; redirect?: string };

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
          <SignInCard method={search.with ?? "passkey"} />
        </div>
      </Unauthenticated>
    </>
  );
};

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    with: search.with === "password" ? "password" : undefined,
    redirect: isLocalPath(search.redirect) ? search.redirect : undefined,
  }),
  component: SignInPage,
});
