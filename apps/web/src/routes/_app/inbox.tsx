import { createFileRoute } from "@tanstack/react-router";
import { InboxList } from "#/features/inbox/inbox-list.tsx";

const InboxPage = () => (
  <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
    <InboxList />
  </main>
);

export const Route = createFileRoute("/_app/inbox")({ component: InboxPage });
