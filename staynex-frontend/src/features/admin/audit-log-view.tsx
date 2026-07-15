"use client";

import { formatDate } from "@/lib/format";
import type { AuditLogRow } from "@/lib/types";

export function AuditLogView({ rows }: { rows: AuditLogRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <details key={row.id} className="group surface-card overflow-hidden">
          <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-center">
            <span>
              <span className="block text-sm font-semibold text-ink">{row.action}</span>
              <span className="text-caption">{row.entityType}</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">{row.entityId}</span>
            <span className="text-sm text-muted-foreground">{actorLabel(row)}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {formatDate(row.createdAt)}
              <span aria-hidden className="transition-transform group-open:rotate-180">
                ↓
              </span>
            </span>
          </summary>

          <div className="grid gap-3 border-t border-border bg-background px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Audit ID" value={row.id} monospace />
            <Detail label="Actor ID" value={row.actorUserId ?? "system"} monospace />
            <Detail label="Actor email" value={row.actorEmail ?? "Not captured"} />
            <Detail label="Property" value={row.propertyName ?? "Not linked"} />
            <Detail label="Property ID" value={row.propertyId ?? "Not linked"} monospace />
            <Detail label="Property slug" value={row.propertySlug ?? "Not linked"} monospace />
            <Detail label="Created" value={new Date(row.createdAt).toLocaleString()} />
          </div>
        </details>
      ))}
    </div>
  );
}

function Detail({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={monospace ? "break-all font-mono text-xs text-ink" : "break-words text-ink"}>
        {value}
      </p>
    </div>
  );
}

function actorLabel(row: AuditLogRow): string {
  if (row.actorName) return row.actorName;
  if (row.actorEmail) return row.actorEmail;
  if (row.actorUserId) return row.actorUserId;
  return "system";
}
