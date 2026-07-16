import { renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import {
  buildStaynexUrl,
  escapeHtml,
  escapeHtmlAttribute,
  formatDate,
  greeting,
} from "./email-template.utils";

export interface PropertyAvailabilityExpiringEmailInput extends StaynexEmailInput {
  propertyId: string;
  propertyName: string;
  ownerName?: string | null;
  availabilityEndsAt: Date | string;
  imageUrl?: string | null;
}

export function renderPropertyAvailabilityExpiringEmail(
  input: PropertyAvailabilityExpiringEmailInput,
): RenderedEmail {
  const endDate = formatDate(input.availabilityEndsAt);
  const image = input.imageUrl
    ? `<img src="${escapeHtmlAttribute(input.imageUrl)}" alt="${escapeHtmlAttribute(input.propertyName)}" width="640" style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;margin:4px 0 20px;border:0;" />`
    : "";

  return renderEmailLayout({
    subject: `Availability ends soon for ${input.propertyName}`,
    preheader: `${input.propertyName} runs out of configured availability on ${endDate}.`,
    heading: "Extend your property availability",
    intro: `${greeting(input.ownerName)} Your configured guest availability for ${input.propertyName} ends in 3 days.`,
    status: { label: "Action needed", tone: "warning" },
    bodyHtml: `${image}<p style="margin:0 0 16px;color:#101014;font-size:15px;line-height:1.65;">Add more dates before <strong>${escapeHtml(endDate)}</strong> so eligible guests can continue finding this property after the current window ends.</p>`,
    textBody: [
      `Configured availability ends: ${endDate}`,
      "Add more dates so the property can remain visible to eligible guests after the current window ends.",
    ],
    details: [
      { label: "Property", value: input.propertyName },
      { label: "Availability through", value: endDate },
    ],
    cta: {
      label: "Extend availability",
      url: buildStaynexUrl(
        input.appOrigin,
        `/host/properties/${encodeURIComponent(input.propertyId)}#availability`,
      ),
    },
    reason:
      "You received this email because you manage this property on Staynex Bookings.",
  });
}
