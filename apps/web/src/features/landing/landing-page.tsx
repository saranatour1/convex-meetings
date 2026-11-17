import { Link } from "@tanstack/react-router";
import { Button } from "@meetings/ui/components/button";
import { Logo } from "#/components/logo.tsx";
import { GithubIcon } from "#/features/auth/provider-icons.tsx";
import { REPO_URL } from "#/lib/seo.ts";

const FEATURES = [
  {
    title: "Schedule across time zones",
    body: "Find a time that works for everyone in your organization. Invites go out by email with a calendar file.",
  },
  {
    title: "Call in the browser",
    body: "Video, screen sharing you can draw on, chat and reactions. Ring a teammate straight from Members.",
  },
  {
    title: "Keep the recap",
    body: "Every call keeps its transcript, its recording and who joined when.",
  },
  {
    title: "Bring people in",
    body: "Invite links, roles and domain join for your team. Guests join a call without an account.",
  },
];

export const LandingPage = () => {
  return (
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
          <Button size="sm" variant="ghost" render={<a href={REPO_URL} />}>
            <GithubIcon />
            GitHub
          </Button>
          <Button size="sm" render={<Link to="/sign-in" />}>
            Sign in
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-4 py-16 sm:px-6 sm:py-24">
        <section className="flex flex-col items-start gap-6">
          <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
            Schedule meetings, call in the browser, keep the recap.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            An open-source meetings app for teams. Sign in with Google or GitHub to use it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" render={<Link to="/sign-in" />}>
              Sign in
            </Button>
            <Button size="lg" variant="outline" render={<a href={REPO_URL} />}>
              Read the source
            </Button>
          </div>
        </section>

        <section aria-labelledby="what-it-does">
          <h2 id="what-it-does" className="sr-only">
            What it does
          </h2>
          <ul className="grid gap-8 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-1 text-muted-foreground text-sm">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="real-app" className="rounded-xl border p-6">
          <h2 id="real-app" className="font-medium">
            A real app, not a demo
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Everything on this page works. Sign in and use it with your team. The full source,
            Convex backend included, is on{" "}
            <a href={REPO_URL} className="text-foreground underline underline-offset-4">
              GitHub
            </a>
            .
          </p>
        </section>
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
};
