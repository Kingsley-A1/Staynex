import { renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting } from "./email-template.utils";

export interface PropertyPublishedEmailInput extends StaynexEmailInput {
  published: true;
  propertyId: string;
  ownerName?: string | null;
  propertyName: string;
}

export function renderPropertyPublishedEmail(input: PropertyPublishedEmailInput): RenderedEmail {
  return renderEmailLayout({
    subject: "Your Staynex property is live",
    preheader: `${input.propertyName} is now live on Staynex.`,
    heading: "Your property is live",
    intro: `${greeting(input.ownerName)} Your persisted property status is approved and the listing is now public on Staynex.`,
    status: { label: "Live", tone: "success" },
    details: [{ label: "Property", value: input.propertyName }],
    cta: { label: "View property", url: buildStaynexUrl(input.appOrigin, `/host/properties/${encodeURIComponent(input.propertyId)}`) },
    reason: "You received this email because your Staynex property was published.",
  });
}
