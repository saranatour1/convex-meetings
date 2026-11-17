import { Navigate, createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { SignInCard } from "#/features/auth/sign-in-card.tsx";
import { pageHead } from "#/lib/seo.ts";

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
        <Navigate to={(search.redirect ?? "/home") as "/home"} replace />
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
  ssr: "data-only",
  head: () =>
    pageHead({
      title: "Sign in · Meetings",
      description:
        "Sign in to Meetings with Google or GitHub, then confirm it is you with a passkey.",
      canonicalPath: "/sign-in",
    }),
  component: SignInPage,
});
