import Link from "next/link";
import { KpiCard, LinkButton } from "@/ui";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-pill";
import {
  IconApprovals,
  IconBookings,
  IconChart,
  IconPayouts,
  IconPercent,
} from "@/components/icons";
import { getAdminApprovals, getAdminBookings, getAdminPayouts } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // KPIs derive from live operational endpoints — never faked.
  const [approvals, bookings, payouts] = await Promise.all([
    getAdminApprovals(),
    getAdminBookings(),
    getAdminPayouts(),
  ]);

  if (approvals.data === null && bookings.data === null && payouts.data === null) {
    return (
      <div className="surface-card p-8 text-center text-muted-foreground" role="status">
        {approvals.offline || bookings.offline || payouts.offline
          ? "We couldn't reach the admin services. Start the API to see live platform metrics."
          : "No platform data is available yet."}
      </div>
    );
  }

  const queue = approvals.data ?? [];
  const bookingRows = bookings.data?.rows ?? [];
  const totals = payouts.data?.totals;

  const confirmedCount = bookingRows.filter((b) => b.status === "CONFIRMED").length;
  const pendingPaymentCount = bookingRows.filter(
    (b) => b.paymentStatus === "PENDING" || b.paymentStatus === "INITIATED",
  ).length;

  const recentBookings = bookingRows.slice(0, 6);
  const recentApprovals = queue.slice(0, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg text-ink">Overview</h1>
          <p className="text-muted-foreground">Platform health at a glance.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/admin/approvals" variant="secondary">
            Review approvals
          </LinkButton>
          <LinkButton href="/admin/bookings">View bookings</LinkButton>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Gross revenue"
          value={totals ? formatNairaFromKobo(totals.grossRevenueKobo) : "—"}
          hint="Paid bookings"
          icon={<IconChart className="size-5" />}
          href="/admin/payouts"
        />
        <KpiCard
          label="Platform commission"
          value={totals ? formatNairaFromKobo(totals.platformCommissionKobo) : "—"}
          hint="Retained"
          icon={<IconPercent className="size-5" />}
          href="/admin/payouts"
        />
        <KpiCard
          label="Pending payouts"
          value={totals ? formatNairaFromKobo(totals.pendingPayoutKobo) : "—"}
          hint="Owed to hosts"
          icon={<IconPayouts className="size-5" />}
          href="/admin/payouts"
        />
        <KpiCard
          label="Confirmed bookings"
          value={bookings.data ? String(confirmedCount) : "—"}
          hint={bookings.data ? `${pendingPaymentCount} pending payment` : undefined}
          icon={<IconBookings className="size-5" />}
          href="/admin/bookings"
        />
        <KpiCard
          label="Pending approvals"
          value={approvals.data ? String(queue.length) : "—"}
          hint="Awaiting review"
          icon={<IconApprovals className="size-5" />}
          href="/admin/approvals"
        />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent bookings — spans two columns on desktop */}
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-title-sm text-ink">Recent bookings</h2>
            <Link href="/admin/bookings" className="text-sm font-semibold text-primary hover:text-primary-hover">
              View all
            </Link>
          </div>
          <div className="surface-card overflow-x-auto">
            {recentBookings.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                {bookings.data ? "No bookings yet." : "Couldn't load bookings."}
              </p>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Property</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Booking</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentBookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{b.propertyName}</div>
                        <div className="text-caption">
                          {b.cityName} · {formatDate(b.checkIn)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {formatNairaFromKobo(b.amountKobo)}
                      </td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={b.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Approval queue snapshot */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-title-sm text-ink">Approval queue</h2>
            <Link href="/admin/approvals" className="text-sm font-semibold text-primary hover:text-primary-hover">
              View all
            </Link>
          </div>
          <div className="surface-card divide-y divide-border">
            {recentApprovals.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                {approvals.data ? "Queue is clear." : "Couldn't load the queue."}
              </p>
            ) : (
              recentApprovals.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/approvals/${p.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="text-caption">
                      {p.cityName} · {p.roomTypeCount} room type{p.roomTypeCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">Review →</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
