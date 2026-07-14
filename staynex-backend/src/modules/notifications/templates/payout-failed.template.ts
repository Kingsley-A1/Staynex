import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, formatAmount, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PayoutFailedEmailInput extends StaynexEmailInput {
  failed: true;
  ownerName?: string | null;
  propertyName: string;
  amountMinor: number;
  currency: string;
  failureReason?: string | null;
}

export function renderPayoutFailedEmail(input: PayoutFailedEmailInput): RenderedEmail {
  return renderEmailLayout({
    subject: "Your Staynex payout needs attention",
    preheader: `The payout for ${input.propertyName} could not be completed.`,
    heading: "Your payout needs attention",
    intro: `${greeting(input.ownerName)} Staynex could not complete this payout. Your property and booking records are unchanged.`,
    status: { label: "Action required", tone: "error" },
    bodyHtml: callout("Next step", "Review your payout details in Host settings. If they are correct or updating them does not resolve the issue, contact support.", "warning"),
    textBody: ["Review your payout details in Host settings. If they are correct or updating them does not resolve the issue, contact support."],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "Amount", value: formatAmount(input.amountMinor, input.currency) },
      { label: "Reason", value: sanitizeSingleLine(input.failureReason) },
    ],
    cta: { label: "Review payout settings", url: buildStaynexUrl(input.appOrigin, "/host/settings") },
    support: "If updating your payout details does not resolve the issue, contact",
    reason: "You received this email because a payout for your Staynex property reached the failed state.",
  });
}
