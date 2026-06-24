import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-pill";
import { getAdminBookings } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const { data, offline } = await getAdminBookings();

  if (!data) {
    return (
      <div className="surface-card p-6 text-center text-muted-foreground" role="status">
        {offline
          ? "We couldn't reach the booking service. Start the API to see live bookings and payments."
          : "No booking data is available yet."}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <header>
          <h1 className="text-title-lg text-ink">Bookings &amp; payments</h1>
          <p className="text-muted-foreground">Platform-wide operational view.</p>
        </header>

        <div className="surface-card overflow-x-auto">
          {data.bookings.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No bookings yet.</p>
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
                {data.bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{b.propertyName}</div>
                      <div className="text-caption">{b.roomName} · {b.cityName}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.guestEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatNairaFromKobo(b.amountKobo)}
                    </td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={b.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-sm text-ink">Payments</h2>
        <div className="surface-card overflow-x-auto">
          {data.payments.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No payments yet.</p>
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.payments.map((p) => (
                  <tr key={p.bookingId}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink">{p.propertyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.provider ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatNairaFromKobo(p.amountKobo)}
                    </td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
