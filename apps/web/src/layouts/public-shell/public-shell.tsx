import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@meetings/ui/components/button";
import { Logo } from "#/components/logo.tsx";
import { REPO_URL } from "#/lib/seo.ts";

export const PublicShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col bg-background text-foreground">
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2 font-semibold">
        <Logo className="size-7" />
        Meetings
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1">
        <Button size="sm" variant="ghost" render={<Link to="/rooms" />}>
          Public rooms
        </Button>
        <Button size="sm" render={<Link to="/sign-in" />}>
          Sign in
        </Button>
      </nav>
    </header>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      {children}
    </main>
    <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 border-t px-4 py-6 text-muted-foreground text-sm sm:px-6">
      <p>
        Built with{" "}
        <a href="https://convex.dev" className="text-foreground underline underline-offset-4">
          Convex
        </a>
      </p>
      <a href={REPO_URL} className="hover:text-foreground">
        saranatour1/convex-meetings
      </a>
    </footer>
  </div>
);
