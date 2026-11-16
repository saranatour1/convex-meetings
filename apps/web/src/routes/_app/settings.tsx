import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { cn } from "@meetings/ui/lib/utils";

const TABS = [
  { to: "/settings/account", label: "Account" },
  { to: "/settings/general", label: "General" },
  { to: "/settings/meetings", label: "Meetings" },
  { to: "/settings/org", label: "Organization" },
] as const;

const SettingsLayout = () => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
    <div className="flex flex-col gap-3">
      <h1 className="font-semibold text-xl">Settings</h1>
      <nav className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "-mb-px border-transparent border-b-2 px-3 py-2 text-muted-foreground text-sm hover:text-foreground",
              "data-[status=active]:border-foreground data-[status=active]:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
    <Outlet />
  </main>
);

export const Route = createFileRoute("/_app/settings")({ component: SettingsLayout });
