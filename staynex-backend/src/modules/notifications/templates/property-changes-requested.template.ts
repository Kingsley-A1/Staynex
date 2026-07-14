import { callout, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting, sanitizeSingleLine } from "./email-template.utils";

export interface PropertyChangesRequestedEmailInput extends StaynexEmailInput {
  changesRequested: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
  reviewerNote?: string | null;
}

export function renderPropertyChangesRequestedEmail(input: PropertyChangesRequestedEmailInput): RenderedEmail {
  const note = sanitizeSingleLine(input.reviewerNote);
  return renderEmailLayout({
    subject: "Staynex requested changes to your property",
    preheader: `${input.propertyName} needs changes before it can go live.`,
    heading: "Changes were requested",
    intro: `${greeting(input.ownerName)} A Staynex administrator requested updates before this property can go live.`,
    status: { label: "Action required", tone: "warning" },
    bodyHtml: note ? callout("Reviewer note", note, "warning") : "",
    textBody: note ? [`Reviewer note: ${note}`] : ["Review the property and make the requested updates before resubmitting."],
    details: [{ label: "Property", value: input.propertyName }],
    cta: { label: "Update property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    reason: "You received this email because an administrator requested changes to your Staynex property.",
  });
}
