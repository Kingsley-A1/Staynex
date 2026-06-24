import { LinkButton } from "@/ui";
import { getBookingServer } from "@/lib/server-catalog";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const booking = bookingId ? await getBookingServer(bookingId) : null;

  if (!booking) {
    return (
      <main className="layout-container py-16 text-center">
        <p className="text-muted-foreground">We couldn&apos;t load this booking.</p>
        <LinkButton href="/search" className="mt-4">
          Search stays
        </LinkButton>
      </main>
    );
  }

  const confirmed = booking.status === "CONFIRMED";

  return (
    <main className="layout-container py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <div
            className={`mx-auto grid size-12 place-items-center rounded-full text-lg font-bold ${
              confirmed ? "bg-success-surface text-success" : "bg-warning-surface text-warning"
            }`}
          >
            {confirmed ? "✓" : "…"}
          </div>
          <h1 className="text-title-lg text-ink">
            {confirmed ? "Booking confirmed" : "Booking pending"}
          </h1>
          <p className="text-muted-foreground">
            {confirmed
              ? "Your stay is reserved. Keep your reference handy for support."
              : "We're still confirming your payment for this booking."}
          </p>
        </div>

        <div className="surface-card divide-y divide-border px-5 py-2 text-sm">
          <Row label="Property" value={`${booking.propertyName} · ${booking.cityName}`} />
          <Row label="Room" value={booking.roomName} />
          <Row
            label="Dates"
            value={`${booking.checkIn} → ${booking.checkOut} (${booking.nights} night${
              booking.nights === 1 ? "" : "s"
            })`}
          />
          <Row label="Amount" value={formatNairaFromKobo(booking.amountKobo)} />
          <Row label="Payment" value={booking.paymentStatus} />
          <Row label="Reference" value={booking.paymentReference ?? "—"} />
        </div>

        <div className="flex flex-wrap gap-3">
          {confirmed && (
            <LinkButton href={`/reviews/submit?booking=${booking.id}`}>Write a review</LinkButton>
          )}
          <LinkButton href="/search" variant="secondary">
            Browse more stays
          </LinkButton>
          <a
            href="mailto:support@staynex.app"
            className="inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-primary hover:bg-secondary"
          >
            Get support
          </a>
        </div>
      </div>
    </main>
  );
}
