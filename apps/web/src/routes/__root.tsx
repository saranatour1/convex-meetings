import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { THEME_SCRIPT } from "#/lib/theme.ts";
import { ToastProvider } from "@meetings/ui/components/toast";
import { ConvexWithAuthProvider } from "#/providers/convex.tsx";
import { AnalyticsProvider } from "#/providers/analytics.tsx";
import { PasskeyGate } from "#/features/auth/passkey-gate.tsx";
import { SITE_LINKS, SITE_META } from "#/lib/seo.ts";
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
  ssr: ({ location }) =>
    location.pathname === "/" || location.pathname.startsWith("/rooms") ? true : "data-only",
  head: () => ({
    meta: SITE_META,
    links: [...SITE_LINKS, { rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
});
