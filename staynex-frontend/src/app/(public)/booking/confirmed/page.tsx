import { LinkButton } from "@/ui";
import { getBookingServer } from "@/lib/server-catalog";
import { voucherPdfUrl, voucherQrUrl } from "@/lib/api-base";
import { formatDate, formatNairaFromKobo, formatOccupancy } from "@/lib/format";

export const dynamic = "force-dynamic";

// Primary-button look for the external PDF download (a plain <a>, not next/link —
// this points at the API origin and the server forces the attachment).
const DOWNLOAD_BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active";

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="block font-medium text-ink">{value}</span>
        {sub ? <span className="block text-caption text-muted-foreground">{sub}</span> : null}
      </span>
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
        <h1 className="text-title-md text-ink">This booking could not be opened</h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          It may belong to another account, your session may have expired, or Staynex may be
          temporarily unavailable. Sign in with the booking account, then retry.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          {bookingId ? (
            <LinkButton href={`/booking/confirmed?booking=${encodeURIComponent(bookingId)}`}>
              Retry
            </LinkButton>
          ) : null}
          <LinkButton href="/search" variant="secondary">
            Close and search stays
          </LinkButton>
        </div>
      </main>
    );
  }

  const confirmed = booking.status === "CONFIRMED";
  const isTest = booking.paymentMode === "TEST";
  const reference = booking.paymentReference;
  const showVoucher = confirmed && Boolean(reference);
  const roomSub = booking.unitCode
    ? `Unit ${booking.unitCode} · assigned at check-in`
    : "Room assigned at check-in";

  return (
    <main className="layout-container py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <div
            className={`mx-auto grid size-12 place-items-center rounded-full text-lg font-bold ${
              confirmed && !isTest
                ? "bg-success-surface text-success"
                : "bg-warning-surface text-warning"
            }`}
          >
            {isTest ? "T" : confirmed ? "✓" : "…"}
          </div>
          <h1 className="text-title-lg text-ink">
            {isTest ? "Test booking confirmed" : confirmed ? "Booking confirmed" : "Booking pending"}
          </h1>
          <p className="text-muted-foreground">
            {isTest
              ? "No money was charged. This sandbox booking does not reserve live inventory and is not valid for check-in."
              : confirmed
                ? "Your stay is reserved. Present this confirmation at check-in."
              : "We're still confirming your payment for this booking."}
          </p>
        </div>

        {/* Verification band — the QR reception scans, plus the PDF download. */}
        {showVoucher && reference && (
          <div className="surface-card flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left">
            <img
              src={voucherQrUrl(reference)}
              alt={isTest ? "Scan to verify this test booking" : "Scan to verify this booking at check-in"}
              width={132}
              height={132}
              className="size-[132px] shrink-0 rounded-lg border border-border bg-white p-2"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-ink">
                {isTest ? "Test evidence — not valid for check-in" : "Present this at check-in"}
              </p>
              <p className="text-caption text-muted-foreground">
                {isTest
                  ? "The verification page will identify this as a no-charge test booking."
                  : "The host scans this code to verify your booking on Staynex — no screenshot needed. Your receipt is also in your email."}
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <a href={voucherPdfUrl(reference)} className={DOWNLOAD_BTN}>
                  Download receipt (PDF)
                </a>
                <LinkButton href={`/verify/${reference}`} variant="secondary" size="md">
                  Preview verification
                </LinkButton>
              </div>
            </div>
          </div>
        )}

        <div className="surface-card divide-y divide-border px-5 py-2 text-sm">
          <Row label="Property" value={`${booking.propertyName} · ${booking.cityName}`} />
          <Row label="Room" value={booking.roomName} sub={roomSub} />
          <Row label="Check-in" value={formatDate(booking.checkIn)} />
          <Row label="Check-out" value={formatDate(booking.checkOut)} />
          <Row
            label="Nights"
            value={`${booking.nights} night${booking.nights === 1 ? "" : "s"}`}
          />
          <Row
            label="Guests"
            value={formatOccupancy({
              adults: booking.adults,
              children: booking.children,
              infants: booking.infants,
            })}
          />
          <Row
            label={isTest ? "Test amount" : "Amount paid"}
            value={formatNairaFromKobo(booking.amountKobo)}
          />
          <Row
            label="Payment"
            value={isTest ? "Test payment — no money charged" : booking.paymentStatus}
          />
          <Row label="Reference" value={reference ?? "—"} />
        </div>

        <div className="flex flex-wrap gap-3">
          {confirmed && !isTest && (
            <LinkButton href={`/reviews/submit?booking=${booking.id}`}>Write a review</LinkButton>
          )}
          <LinkButton href="/search" variant="secondary">
            Browse more stays
          </LinkButton>
          <a
            href="mailto:support@staynexbookings.ng"
            className="inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold text-primary hover:bg-secondary"
          >
            Get support
          </a>
        </div>
      </div>
    </main>
  );
}
