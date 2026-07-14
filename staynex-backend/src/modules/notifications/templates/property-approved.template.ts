import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PropertyApprovedEmailInput extends StaynexEmailInput {
  approved: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
  reviewerNote?: string | null;
}

export function renderPropertyApprovedEmail(input: PropertyApprovedEmailInput): RenderedEmail {
  const note = sanitizeSingleLine(input.reviewerNote);
  return renderEmailLayout({
    subject: "Your Staynex property was approved",
    preheader: `${input.propertyName} was manually approved and is live.`,
    heading: "Your property was approved",
    intro: `${greeting(input.ownerName)} A Staynex administrator approved your property and its persisted status is now live.`,
    status: { label: "Approved · Live", tone: "success" },
    bodyHtml: note ? callout("Reviewer note", note, "info") : "",
    textBody: note ? [`Reviewer note: ${note}`] : undefined,
    details: [{ label: "Property", value: input.propertyName }],
    cta: { label: "View property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    reason: "You received this email because an administrator approved your Staynex property.",
  });
}
