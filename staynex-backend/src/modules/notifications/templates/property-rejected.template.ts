import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PropertyRejectedEmailInput extends StaynexEmailInput {
  rejected: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
  reviewerNote?: string | null;
}

export function renderPropertyRejectedEmail(input: PropertyRejectedEmailInput): RenderedEmail {
  const note = sanitizeSingleLine(input.reviewerNote);
  return renderEmailLayout({
    subject: "Your Staynex Bookings property was not approved",
    preheader: `${input.propertyName} was not approved for publication.`,
    heading: "Your property was not approved",
    intro: `${greeting(input.ownerName)} A Staynex Bookings administrator rejected this property submission. It is not live.`,
    status: { label: "Not approved", tone: "error" },
    bodyHtml: note ? callout("Reviewer note", note, "error") : "",
    textBody: note ? [`Reviewer note: ${note}`] : ["Review the property submission for its current state."],
    details: [{ label: "Property", value: input.propertyName }],
    cta: { label: "Review property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    support: "If you need clarification about this review decision, contact",
    reason: "You received this email because an administrator rejected your Staynex Bookings property submission.",
  });
}
