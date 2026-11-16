import { createFileRoute } from "@tanstack/react-router";
import { MembersPanel } from "#/features/orgs/members-panel.tsx";

const MembersPage = () => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
    <MembersPanel />
  </main>
);

export const Route = createFileRoute("/_app/members")({ component: MembersPage });
