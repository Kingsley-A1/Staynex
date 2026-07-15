import { bulletList, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PropertyReviewNeedsChangesEmailInput extends StaynexEmailInput {
  needsChanges: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
  failedLabels?: string[];
}

export function renderPropertyReviewNeedsChangesEmail(input: PropertyReviewNeedsChangesEmailInput): RenderedEmail {
  const issues = (input.failedLabels ?? []).map(sanitizeSingleLine).filter((item): item is string => Boolean(item));
  return renderEmailLayout({
    subject: "Your Staynex Bookings property needs changes",
    preheader: `${input.propertyName} needs updates before publication.`,
    heading: "Your property needs changes",
    intro: `${greeting(input.ownerName)} Update the listing and submit it again for review.`,
    status: { label: "Changes needed", tone: "warning" },
    bodyHtml: issues.length ? bulletList(issues) : "",
    textBody: issues.length ? ["Items to update:", ...issues.map((issue) => `- ${issue}`)] : ["Review the property details to see what needs attention."],
    details: [{ label: "Property", value: input.propertyName }],
    cta: { label: "Update property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    reason: "You received this email because your property review found items that need attention.",
  });
}
