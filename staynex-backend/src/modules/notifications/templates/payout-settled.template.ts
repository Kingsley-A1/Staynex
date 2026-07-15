import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, formatAmount, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PayoutSettledEmailInput extends StaynexEmailInput {
  settled: true;
  ownerName?: string | null;
  propertyName: string;
  amountMinor: number;
  currency: string;
  destination?: { bankName: string; accountNumberLast4: string } | null;
  settlementNote?: string | null;
}

export function renderPayoutSettledEmail(input: PayoutSettledEmailInput): RenderedEmail {
  const bankName = sanitizeSingleLine(input.destination?.bankName);
  const last4 = sanitizeSingleLine(input.destination?.accountNumberLast4);
  const destination = bankName && last4 ? `${bankName} account ending ${last4}` : undefined;
  const note = sanitizeSingleLine(input.settlementNote);
  return renderEmailLayout({
    subject: "Your Staynex Bookings payout was settled",
    preheader: `The payout for ${input.propertyName} is settled.`,
    heading: "Your payout is settled",
    intro: `${greeting(input.ownerName)} Staynex Bookings has recorded this payout as completed.`,
    status: { label: "Settled", tone: "success" },
    bodyHtml: callout("Completed payout", "This message reflects a completed payout state in Staynex Bookings.", "success"),
    textBody: ["This message reflects a completed payout state in Staynex Bookings."],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "Amount", value: formatAmount(input.amountMinor, input.currency) },
      { label: "Destination", value: destination },
      { label: "Settlement note", value: note },
    ],
    cta: { label: "View host bookings", url: buildStaynexUrl(input.appOrigin, "/host/bookings") },
    support: "If this payout does not match your records, contact",
    reason: "You received this email because a payout for your Staynex Bookings property reached the paid state.",
  });
}
