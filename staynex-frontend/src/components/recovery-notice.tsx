"use client";

import { Button, LinkButton } from "@/ui";

export interface RecoveryAction {
  label: string;
  href?: string;
  onSelect?: () => void;
}

/** Calm, actionable recovery for unavailable operations and retriable errors. */
export function RecoveryNotice({
  title,
  reason,
  retryLabel = "Retry",
  onRetry,
  retryHref,
  secondaryAction,
  compact = false,
}: {
  title: string;
  reason: string;
  retryLabel?: string;
  onRetry?: () => void;
  retryHref?: string;
  secondaryAction: RecoveryAction;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-warning-border bg-warning-surface text-left ${
        compact ? "p-4" : "mx-auto max-w-2xl p-6"
      }`}
      role="status"
    >
      <div className="space-y-1">
        <h2 className="text-title-sm text-ink">{title}</h2>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {retryHref ? (
          <LinkButton href={retryHref} size="sm">
            {retryLabel}
          </LinkButton>
        ) : onRetry ? (
          <Button type="button" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {secondaryAction.href ? (
          <LinkButton href={secondaryAction.href} variant="secondary" size="sm">
            {secondaryAction.label}
          </LinkButton>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={secondaryAction.onSelect}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </section>
  );
}
