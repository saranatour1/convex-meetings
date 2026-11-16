import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { THEME_SCRIPT } from "#/lib/theme.ts";
import { ToastProvider } from "@meetings/ui/components/toast";
import { ConvexWithAuthProvider } from "#/providers/convex.tsx";
import { AnalyticsProvider } from "#/providers/analytics.tsx";
import { PasskeyGate } from "#/features/auth/passkey-gate.tsx";
import appCss from "../styles.css?url";

const RootComponent = () => {
  return (
    <ConvexWithAuthProvider>
      <AnalyticsProvider>
        <ToastProvider>
          <PasskeyGate>
            <Outlet />
          </PasskeyGate>
        </ToastProvider>
      </AnalyticsProvider>
    </ConvexWithAuthProvider>
  );
};

const RootDocument = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meetings" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
});
