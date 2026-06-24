import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PROPERTY_STATUS_LABELS, type PropertyStatus } from "@/lib/types";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<PropertyStatus, string> = {
  DRAFT: "border-border bg-secondary text-secondary-foreground",
  PENDING_REVIEW: "border-warning-border bg-warning-surface text-warning",
  APPROVED: "border-success-border bg-success-surface text-success",
  REJECTED: "border-error-border bg-error-surface text-error",
  ARCHIVED: "border-border bg-neutral-100 text-muted-foreground",
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{PROPERTY_STATUS_LABELS[status]}</Badge>;
}
