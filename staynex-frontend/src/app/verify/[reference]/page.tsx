import Link from "next/link";
import type { Metadata } from "next";
import { getVoucherVerification } from "@/lib/server-catalog";
import { formatDate } from "@/lib/format";
import type { VoucherVerification } from "@/lib/types";

// Reception scans a QR to reach this page; it must always reflect live truth.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify booking · Staynex",
  robots: { index: false, follow: false },
};

type Status = VoucherVerification["status"];

const TONE: Record<Status, { wrap: string; icon: string; title: string; note: string }> = {
  CONFIRMED: {
    wrap: "border-success-border bg-success-surface text-success",
    icon: "✓",
    title: "Valid booking",
    note: "Paid & confirmed on Staynex.",
  },
  TEST: {
    wrap: "border-warning-border bg-warning-surface text-warning",
    icon: "T",
    title: "Test booking — not valid for check-in",
    note: "No money was charged and no live room was reserved.",
  },
  PENDING: {
    wrap: "border-warning-border bg-warning-surface text-warning",
    icon: "…",
    title: "Payment pending",
    note: "Not confirmed yet — do not check the guest in on this alone.",
  },
  CANCELLED: {
    wrap: "border-error-border bg-error-surface text-error",
    icon: "✕",
    title: "Not valid",
    note: "This booking was cancelled or refunded.",
  },
  NOT_FOUND: {
    wrap: "border-error-border bg-error-surface text-error",
    icon: "✕",
    title: "No booking found",
    note: "We couldn't find a Staynex booking for this code.",
  },
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const verification = await getVoucherVerification(reference);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <p className="text-center text-title-sm font-bold tracking-tight text-primary">STAYNEX</p>

        {verification === null ? (
          <div className="surface-card space-y-3 p-6 text-center">
            <p className="text-title-sm text-ink">Couldn&apos;t verify right now</p>
            <p className="text-sm text-muted-foreground">
              Staynex could not reach the booking records. Check the connection, then retry;
              do not use this page as check-in approval until verification succeeds.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href={`/verify/${encodeURIComponent(reference)}`}
                className="font-semibold text-primary hover:underline"
              >
                Retry verification
              </Link>
              <Link href="/" className="text-muted-foreground hover:underline">
                Close
              </Link>
            </div>
          </div>
        ) : (
          <VerificationCard v={verification} />
        )}

        <p className="text-center text-caption text-muted-foreground">
          Current status from Staynex records · not a screenshot.
        </p>
      </div>
    </main>
  );
}

function VerificationCard({ v }: { v: VoucherVerification }) {
  const tone = TONE[v.status];
  const showDetails = v.status !== "NOT_FOUND";

  return (
    <div className="surface-card overflow-hidden">
      <div className={`flex items-center gap-4 border-b p-5 ${tone.wrap}`}>
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/70 text-2xl font-bold">
          {tone.icon}
        </span>
        <div className="min-w-0">
          <p className="text-title-sm font-bold">{tone.title}</p>
          <p className="text-sm opacity-90">{tone.note}</p>
        </div>
      </div>

      {showDetails && (
        <div className="divide-y divide-border px-5 py-1 text-sm">
          {v.propertyName && (
            <DetailRow
              label="Property"
              value={[v.propertyName, v.cityName].filter(Boolean).join(" · ")}
            />
          )}
          {v.roomTypeName && (
            <DetailRow label="Room type" value={v.roomTypeName} />
          )}
          {v.checkIn && <DetailRow label="Check-in" value={formatDate(v.checkIn)} />}
          {v.checkOut && <DetailRow label="Check-out" value={formatDate(v.checkOut)} />}
          <DetailRow label="Reference" value={v.reference} />
        </div>
      )}

      <div className="border-t border-border px-5 py-3">
        <Link href="/" className="text-caption font-semibold text-primary hover:underline">
          What is Staynex?
        </Link>
      </div>
    </div>
  );
}
