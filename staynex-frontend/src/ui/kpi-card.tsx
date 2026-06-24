import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-overline">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-caption">{hint}</p>}
    </div>
  );
}
