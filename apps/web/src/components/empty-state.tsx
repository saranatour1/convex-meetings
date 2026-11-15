import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@meetings/ui/components/empty";
import { cn } from "@meetings/ui/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn(compact && "gap-3", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={cn(compact && "mb-3")}>
          {icon}
        </EmptyMedia>
        <EmptyTitle className={compact ? "text-sm" : "text-base"}>{title}</EmptyTitle>
        <EmptyDescription className={cn(compact && "text-xs")}>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
