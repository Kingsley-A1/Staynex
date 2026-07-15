import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, formatDateTime, greeting } from "./email-template.utils";

export interface PropertyAutoReviewScheduledEmailInput extends StaynexEmailInput {
  scheduled: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
  scheduledAt: Date | string;
}

export function renderPropertyAutoReviewScheduledEmail(input: PropertyAutoReviewScheduledEmailInput): RenderedEmail {
  return renderEmailLayout({
    subject: "Your Staynex Bookings property is scheduled for publication",
    preheader: `${input.propertyName} passed automated review and is scheduled for publication.`,
    heading: "Publication is scheduled",
    intro: `${greeting(input.ownerName)} Your property passed Staynex Bookings' automated review checks.`,
    status: { label: "Scheduled", tone: "success" },
    bodyHtml: callout("No action required", "The listing remains scheduled while its reviewed content stays unchanged.", "info"),
    textBody: ["No action is required. The listing remains scheduled while its reviewed content stays unchanged."],
    details: [{ label: "Property", value: input.propertyName }, { label: "Scheduled publication", value: formatDateTime(input.scheduledAt) }],
    cta: { label: "View property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    reason: "You received this email because your property passed automated review and received an authoritative publication schedule.",
  });
}
