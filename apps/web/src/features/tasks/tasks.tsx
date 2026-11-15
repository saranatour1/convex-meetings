import { ListTodoIcon } from "lucide-react";
import { EmptyState } from "#/components/empty-state.tsx";

export const Tasks = () => {
  return (
    <EmptyState
      compact
      className="px-2 py-8"
      icon={<ListTodoIcon />}
      title="All caught up"
      description="Action items from your meetings will land here."
    />
  );
};
