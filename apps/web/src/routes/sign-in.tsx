import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { SignInCard } from "#/features/auth/sign-in-card.tsx";

type SignInSearch = { with?: "password"; mode?: "signup" };

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    with: search.with === "password" ? "password" : undefined,
    mode: search.mode === "signup" ? "signup" : undefined,
  }),
  component: SignInPage,
});

function SignInPage() {
  const search = Route.useSearch();

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Authenticated>
        <Navigate to="/" replace />
      </Authenticated>
      <Unauthenticated>
        <div className="grid min-h-dvh place-items-center bg-sidebar p-4">
          <SignInCard method={search.with ?? "passkey"} mode={search.mode ?? "signin"} />
        </div>
      </Unauthenticated>
    </>
  );
}
