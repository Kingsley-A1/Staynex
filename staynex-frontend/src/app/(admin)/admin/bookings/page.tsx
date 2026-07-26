import Link from "next/link";
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  PayoutStatusBadge,
} from "@/components/status-pill";
import { PaymentActions } from "@/features/admin/payment-actions";
import {
  getAdminBookings,
  getAdminPaymentExceptions,
  getAdminPayments,
} from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate, formatOccupancy } from "@/lib/format";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  type BookingStatus,
  type PaymentState,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageSearchParams {
  q?: string;
  bstatus?: string;
  pstatus?: string;
  bcursor?: string;
  pcursor?: string;
}

/** Same-page link that swaps one cursor param, preserving the filters. */
function pageHref(params: PageSearchParams, patch: Partial<PageSearchParams>): string {
  const next = new URLSearchParams();
  const merged = { ...params, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value) next.set(key, value);
  }
  const qs = next.toString();
  return `/admin/bookings${qs ? `?${qs}` : ""}`;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const [bookingsRes, paymentsRes, exceptionsRes] = await Promise.all([
    getAdminBookings({ q: params.q, status: params.bstatus, cursor: params.bcursor }),
    getAdminPayments({ q: params.q, status: params.pstatus, cursor: params.pcursor }),
    getAdminPaymentExceptions(),
  ]);

  if (!bookingsRes.data || !paymentsRes.data) {
    return (
      <div className="surface-card p-6 text-center text-muted-foreground" role="status">
        {bookingsRes.offline || paymentsRes.offline
          ? "We couldn't reach the booking service. Start the API to see live bookings and payments."
          : "No booking data is available yet."}
      </div>
    );
  }

  const bookings = bookingsRes.data;
  const payments = paymentsRes.data;
  const exceptions = exceptionsRes.data ?? [];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-title-lg text-ink">Bookings &amp; payments</h1>
        <p className="text-muted-foreground">Platform-wide operational view.</p>
      </header>

      {/* Exception queue: funds moved, human action owed. Must trend to empty. */}
      {exceptions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-title-sm text-error">
            Payment exceptions ({exceptions.length}) — action required
          </h2>
          <div className="surface-card overflow-x-auto border-error-border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Property / guest</th>
                  <th className="px-4 py-3 font-semibold text-right">Captured</th>
                  <th className="px-4 py-3 font-semibold">Why</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exceptions.map((e) => (
                  <tr key={e.bookingId}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {e.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{e.propertyName}</div>
                      <div className="text-caption">{e.guestEmail ?? "anonymous guest"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatNairaFromKobo(e.grossAmountKobo)}
                    </td>
                    <td className="max-w-[320px] px-4 py-3 text-caption text-muted-foreground">
                      {e.events[0]?.detail ?? e.events[0]?.outcome ?? "Flagged for refund."}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.reference ? (
                        <PaymentActions reference={e.reference} status={e.status} provider={e.provider} />
                      ) : (
                        <span className="text-caption text-muted-foreground">No reference</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Shared search + per-section status filters (GET form, server-rendered). */}
      <form method="GET" className="surface-card flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-caption font-medium text-muted-foreground">
          Search
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Reference, guest email, or property"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-caption font-medium text-muted-foreground">
          Booking status
          <select
            name="bstatus"
            defaultValue={params.bstatus ?? ""}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption font-medium text-muted-foreground">
          Payment status
          <select
            name="pstatus"
            defaultValue={params.pstatus ?? ""}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Object.entries(PAYMENT_STATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Filter
        </button>
        {(params.q || params.bstatus || params.pstatus) && (
          <Link href="/admin/bookings" className="text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Bookings</h2>
        <div className="surface-card overflow-x-auto">
          {bookings.rows.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No bookings match.</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Guest</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{b.propertyName}</div>
                      <div className="text-caption">{b.roomName} · {b.cityName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground">{b.guestEmail ?? "—"}</div>
                      <div className="text-caption">{formatOccupancy(b)}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatNairaFromKobo(b.amountKobo)}
                    </td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.status as BookingStatus} /></td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={b.paymentStatus as PaymentState} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-between">
          {params.bcursor ? (
            <Link href={pageHref(params, { bcursor: undefined })} className="text-sm text-primary underline">
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {bookings.nextCursor && (
            <Link
              href={pageHref(params, { bcursor: bookings.nextCursor })}
              className="text-sm text-primary underline"
            >
              Older bookings →
            </Link>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Payments</h2>
        <div className="surface-card overflow-x-auto">
          {payments.rows.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No payments match.</p>
          ) : (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Property / guest</th>
                  <th className="px-4 py-3 font-semibold text-right">Gross</th>
                  <th className="px-4 py-3 font-semibold text-right">Staynex fee</th>
                  <th className="px-4 py-3 font-semibold text-right">Host payout</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Payout</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.rows.map((p) => (
                  <tr key={p.bookingId}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink">{p.propertyName}</div>
                      <div className="text-caption">{p.guestEmail ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">
                      {formatNairaFromKobo(p.grossAmountKobo)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatNairaFromKobo(p.platformFeeKobo)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">
                      {formatNairaFromKobo(p.ownerPayoutKobo)}
                    </td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3"><PayoutStatusBadge status={p.payoutStatus} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.reference ? (
                        <PaymentActions reference={p.reference} status={p.status} provider={p.provider} />
                      ) : (
                        <span className="text-caption text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-between">
          {params.pcursor ? (
            <Link href={pageHref(params, { pcursor: undefined })} className="text-sm text-primary underline">
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {payments.nextCursor && (
            <Link
              href={pageHref(params, { pcursor: payments.nextCursor })}
              className="text-sm text-primary underline"
            >
              Older payments →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
