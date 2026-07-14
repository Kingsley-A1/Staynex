import { callout, paragraph, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, calculateNights, formatAmount, formatDate, greeting, pluralize } from "./email-template.utils";

export interface BookingConfirmedEmailInput extends StaynexEmailInput {
  /** Callers may construct this input only after booking CONFIRMED + payment SUCCESS checks. */
  confirmed: true;
  paymentVerified: true;
  bookingId: string;
  guestName?: string | null;
  propertyName: string;
  city: string;
  locationDetail?: string | null;
  roomType: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guestCount?: number;
  paidAmountMinor: number;
  currency: string;
  reference?: string | null;
  voucherAttached: boolean;
}

export function renderBookingConfirmedEmail(input: BookingConfirmedEmailInput): RenderedEmail {
  const nights = calculateNights(input.checkIn, input.checkOut);
  const url = buildStaynexUrl(input.appOrigin, `/booking/confirmed?booking=${encodeURIComponent(input.bookingId)}`);
  const voucher = input.voucherAttached ? callout("Booking Confirmation & Receipt", "Your verified voucher PDF is attached. Keep the voucher, booking reference, or QR code available for check-in.", "info") : "";
  return renderEmailLayout({
    subject: `Your Staynex booking is confirmed — ${input.propertyName}`,
    preheader: `Your booking at ${input.propertyName} is confirmed.`,
    heading: "Your stay is confirmed",
    intro: `${greeting(input.guestName)} Staynex has verified your payment and reserved your booking.`,
    status: { label: "Confirmed · Payment verified", tone: "success" },
    bodyHtml: paragraph("Your confirmed stay details are below. Keep the reference available if you contact support.") + voucher,
    textBody: ["Staynex has verified your payment and reserved your booking.", ...(input.voucherAttached ? ["Your verified Booking Confirmation & Receipt PDF is attached. Keep it, the reference, or its QR code available for check-in."] : [])],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "Location", value: [input.locationDetail, input.city].filter(Boolean).join(", ") },
      { label: "Room", value: input.roomType },
      { label: "Check-in", value: formatDate(input.checkIn) },
      { label: "Check-out", value: formatDate(input.checkOut) },
      { label: "Stay", value: pluralize(nights, "night") },
      { label: "Guests", value: input.guestCount ? pluralize(input.guestCount, "guest") : undefined },
      { label: "Amount paid", value: formatAmount(input.paidAmountMinor, input.currency) },
      { label: "Reference", value: input.reference },
    ],
    cta: { label: "View booking", url },
    support: "If any verified booking detail looks incorrect, keep your reference ready and contact",
    reason: "You received this email because payment was verified and this booking was confirmed by Staynex.",
  });
}
