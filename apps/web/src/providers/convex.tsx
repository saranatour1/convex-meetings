import type { ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { api } from "@meetings/backend";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function ConvexWithAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} api={api.auth}>
      {children}
    </ConvexAuthProvider>
  );
}
