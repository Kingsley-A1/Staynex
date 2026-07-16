import type { ReactNode } from "react";
import { IconVerified } from "@/components/icons";
import { cn } from "@/lib/cn";
import {
  PROPERTY_REVIEW_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  type PropertyReviewStatus,
  type PropertyStatus,
} from "@/lib/types";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
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
  return (
    <Badge className={STATUS_STYLES[status]}>
      {PROPERTY_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Guest-facing trust mark for a property approved by Staynex. */
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-surface/95 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
      <IconVerified className="size-4 shrink-0" />
      <span>Verified</span>
    </span>
  );
}

const REVIEW_STATUS_STYLES: Record<PropertyReviewStatus, string> = {
  NOT_SUBMITTED: "border-border bg-secondary text-secondary-foreground",
  PENDING: "border-warning-border bg-warning-surface text-warning",
  FAILED: "border-error-border bg-error-surface text-error",
  SCHEDULED: "border-warning-border bg-warning-surface text-warning",
  PUBLISHED: "border-success-border bg-success-surface text-success",
  CANCELLED: "border-border bg-neutral-100 text-muted-foreground",
  MANUAL_REVIEW: "border-primary/20 bg-primary/10 text-primary",
};

export function ReviewStatusBadge({
  status,
}: {
  status: PropertyReviewStatus;
}) {
  return (
    <Badge className={REVIEW_STATUS_STYLES[status]}>
      {PROPERTY_REVIEW_STATUS_LABELS[status]}
    </Badge>
  );
}
