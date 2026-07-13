import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, formatDate, greeting } from "./email-template.utils";

export interface CheckInReminderEmailInput extends StaynexEmailInput {
  bookingId: string;
  guestName?: string | null;
  propertyName: string;
  city: string;
  roomType?: string | null;
  checkIn: Date | string;
  reference?: string | null;
  hasVoucher: boolean;
}

export function renderCheckInReminderEmail(input: CheckInReminderEmailInput): RenderedEmail {
  const url = buildStaynexUrl(input.appOrigin, `/booking/confirmed?booking=${encodeURIComponent(input.bookingId)}`);
  const reminder = input.hasVoucher ? "Keep your booking reference or voucher available for check-in." : "Keep your booking reference available for check-in.";
  return renderEmailLayout({
    subject: `Check-in reminder — ${input.propertyName}`,
    preheader: `Your check-in at ${input.propertyName} is tomorrow.`,
    heading: "Your check-in is tomorrow",
    intro: `${greeting(input.guestName)} Here is a practical reminder for your upcoming confirmed stay.`,
    bodyHtml: callout("Before you arrive", reminder, "info"),
    textBody: [reminder],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "City", value: input.city },
      { label: "Check-in date", value: formatDate(input.checkIn) },
      { label: "Room", value: input.roomType },
      { label: "Reference", value: input.reference },
    ],
    cta: { label: input.hasVoucher ? "View booking and voucher" : "View booking", url },
    support: "If you need help with your booking details, contact",
    reason: "You received this reminder because this confirmed Staynex booking checks in tomorrow.",
  });
}
