import type { ReactNode } from "react";
import Link from "next/link";

function Inner({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <>
      <p className="text-overline">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-caption">{hint}</p>}
    </>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  href?: string;
}) {
  if (href) {
    return (
      <Link
        href={href}
        className="surface-card block p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Inner label={label} value={value} hint={hint} />
      </Link>
    );
  }
  return (
    <div className="surface-card p-5">
      <Inner label={label} value={value} hint={hint} />
    </div>
  );
}
