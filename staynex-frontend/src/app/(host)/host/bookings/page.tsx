import Link from "next/link";
import { KpiCard } from "@/ui";
import { BookingStatusBadge, PaymentStatusBadge, PayoutStatusBadge } from "@/components/status-pill";
import { getHostBookings } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate, formatOccupancy } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerBookingsPage() {
  // Session-only auth: the backend scopes every row to the signed-in owner.
  const { data, offline } = await getHostBookings();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-title-lg text-ink">Bookings</h1>
        <p className="text-muted-foreground">Confirmed and pending stays across your properties.</p>
      </header>

      {!data ? (
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline
            ? "We couldn't reach the booking service. Start the API to see live bookings."
            : "No booking data is available yet."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Confirmed bookings" value={String(data.kpis.confirmedBookings)} />
            <KpiCard label="Pending payments" value={String(data.kpis.pendingPayments)} />
            <KpiCard
              label="Net earnings"
              value={formatNairaFromKobo(data.kpis.netEarningsKobo)}
              hint="Paid, after platform fee"
            />
            <KpiCard
              label="Pending payout"
              value={formatNairaFromKobo(data.kpis.pendingPayoutKobo)}
              hint="Awaiting settlement"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-title-sm text-ink">Recent bookings</h2>
            {data.bookings.length === 0 ? (
              <div className="surface-card p-6 text-center text-muted-foreground">
                No bookings yet. Once guests pay, confirmed stays appear here.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/host/bookings/${b.id}`}
                      className="surface-card flex flex-col gap-3 p-4 transition-colors hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {b.propertyName} · {b.roomName}
                        </p>
                        <p className="text-caption">
                          {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} night
                          {b.nights === 1 ? "" : "s"} · {formatOccupancy(b)}
                          {b.guestEmail ? ` · ${b.guestEmail}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-ink">
                            {formatNairaFromKobo(b.ownerPayoutKobo)}
                          </p>
                          <p className="text-caption">{formatNairaFromKobo(b.grossAmountKobo)} gross</p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                        <PaymentStatusBadge status={b.paymentStatus} />
                        <PayoutStatusBadge status={b.payoutStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
