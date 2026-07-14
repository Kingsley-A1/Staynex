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

  const verified =
    booking?.status === "CONFIRMED" && booking.paymentStatus === "SUCCESS";

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
          {verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success">
              <span aria-hidden>✓</span> Verified
            </span>
          )}
        </div>
      </header>

      {/* Host-side check-in proof: the same live card the guest's QR opens. */}
      {verified && booking.paymentReference && (
        <section className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-success-surface text-lg font-bold text-success"
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Verified booking</p>
              <p className="text-caption text-muted-foreground">
                Payment is confirmed on Staynex. Open the live card to check the guest in — it&apos;s
                the same one the guest&apos;s QR opens.
              </p>
            </div>
          </div>
          <LinkButton
            href={`/verify/${booking.paymentReference}`}
            variant="secondary"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            Open verification
          </LinkButton>
        </section>
      )}

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
