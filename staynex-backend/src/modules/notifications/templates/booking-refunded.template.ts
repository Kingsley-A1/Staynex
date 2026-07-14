import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, formatAmount, greeting } from "./email-template.utils";

export interface BookingRefundedEmailInput extends StaynexEmailInput {
  refunded: true;
  guestName?: string | null;
  propertyName: string;
  refundedAmountMinor: number;
  currency: string;
  reference?: string | null;
}

export function renderBookingRefundedEmail(input: BookingRefundedEmailInput): RenderedEmail {
  const cta = input.reference ? { label: "View payment status", url: buildStaynexUrl(input.appOrigin, `/payment/status?reference=${encodeURIComponent(input.reference)}`) } : undefined;
  return renderEmailLayout({
    subject: "Your Staynex booking payment was refunded",
    preheader: `A refund for ${input.propertyName} has been recorded.`,
    heading: "Your payment was refunded",
    intro: `${greeting(input.guestName)} Staynex has recorded this booking payment as refunded.`,
    status: { label: "Refunded", tone: "success" },
    bodyHtml: callout("What happens next", "The refund was returned through the original payment process. When it appears in your account depends on your payment provider.", "info"),
    textBody: ["The refund was returned through the original payment process. When it appears depends on your payment provider."],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "Amount refunded", value: formatAmount(input.refundedAmountMinor, input.currency) },
      { label: "Reference", value: input.reference },
    ],
    cta,
    support: "If you have questions about this refund, keep the payment reference ready and contact",
    reason: "You received this email because Staynex recorded the booking payment as refunded.",
  });
}
