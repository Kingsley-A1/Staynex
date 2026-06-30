import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface KpiTrend {
  value: string;
  direction: "up" | "down" | "neutral";
}

function TrendPill({ trend }: { trend: KpiTrend }) {
  const tone =
    trend.direction === "up"
      ? "text-success"
      : trend.direction === "down"
        ? "text-error"
        : "text-muted-foreground";
  const arrow = trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "■";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone)}>
      {trend.direction !== "neutral" && <span aria-hidden>{arrow}</span>}
      {trend.value}
    </span>
  );
}

function Inner({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: KpiTrend;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-overline">{label}</p>
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {(hint || trend) && (
        <div className="mt-1 flex items-center gap-2">
          {trend && <TrendPill trend={trend} />}
          {hint && <span className="text-caption">{hint}</span>}
        </div>
      )}
    </>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  href,
  icon,
  trend,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
  trend?: KpiTrend;
}) {
  const inner = <Inner label={label} value={value} hint={hint} icon={icon} trend={trend} />;
  if (href) {
    return (
      <Link
        href={href}
        className="surface-card block p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {inner}
      </Link>
    );
  }
  return <div className="surface-card p-5">{inner}</div>;
}
