import Link from "next/link";
import { KpiCard } from "@/ui";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-pill";
import { getOwnerBookings } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnerBookingsPage() {
  // Session-only auth: the backend scopes every row to the signed-in owner.
  const { data, offline } = await getOwnerBookings();

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
            <KpiCard label="Available rooms" value={String(data.kpis.availableRooms)} />
            <KpiCard
              label="Est. earnings"
              value={formatNairaFromKobo(data.kpis.estimatedEarningsKobo)}
              hint="Confirmed payments"
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
                      href={`/owner/bookings/${b.id}`}
                      className="surface-card flex flex-col gap-3 p-4 transition-colors hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {b.propertyName} · {b.roomName}
                        </p>
                        <p className="text-caption">
                          {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} night
                          {b.nights === 1 ? "" : "s"}
                          {b.guestEmail ? ` · ${b.guestEmail}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">
                          {formatNairaFromKobo(b.amountKobo)}
                        </span>
                        <BookingStatusBadge status={b.status} />
                        <PaymentStatusBadge status={b.paymentStatus} />
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
