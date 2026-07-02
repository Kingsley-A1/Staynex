import { LinkButton } from "@/ui";
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  PayoutStatusBadge,
} from "@/components/status-pill";
import { getHostBooking } from "@/lib/server-reports";
import { formatNairaFromKobo, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function OwnerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: booking, offline } = await getHostBooking(id);

  if (!booking) {
    return (
      <div className="space-y-4">
        <LinkButton href="/host/bookings" variant="secondary">
          ← All bookings
        </LinkButton>
        <div className="surface-card p-6 text-center text-muted-foreground" role="status">
          {offline
            ? "We couldn't reach the booking service."
            : "This booking wasn't found in your properties."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <LinkButton href="/host/bookings" variant="secondary">
        ← All bookings
      </LinkButton>

      <header className="space-y-2">
        <h1 className="text-title-lg text-ink">{booking.propertyName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={booking.paymentStatus} />
        </div>
      </header>

      <div className="surface-card divide-y divide-border px-5 py-2 text-sm">
        <Row label="Room" value={booking.roomName} />
        <Row label="City" value={booking.cityName} />
        <Row
          label="Dates"
          value={`${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)} (${booking.nights} night${
            booking.nights === 1 ? "" : "s"
          })`}
        />
        <Row label="Guest" value={booking.guestEmail ?? "—"} />
        <Row label="Reference" value={booking.paymentReference ?? "—"} />
        <Row label="Created" value={formatDate(booking.createdAt)} />
      </div>

      <section className="space-y-2">
        <h2 className="text-title-sm text-ink">Settlement</h2>
        <div className="surface-card divide-y divide-border px-5 py-2 text-sm">
          <Row label="Guest paid (gross)" value={formatNairaFromKobo(booking.grossAmountKobo)} />
          <Row label="Platform fee" value={`− ${formatNairaFromKobo(booking.platformFeeKobo)}`} />
          <div className="flex justify-between gap-4 py-2">
            <span className="font-medium text-ink">Your payout</span>
            <span className="text-right font-semibold text-ink">
              {formatNairaFromKobo(booking.ownerPayoutKobo)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-muted-foreground">Payout status</span>
            <PayoutStatusBadge status={booking.payoutStatus} />
          </div>
        </div>
        <p className="text-caption">
          Payouts are settled after check-in. Net of the Staynex platform fee.
        </p>
      </section>
    </div>
  );
}
