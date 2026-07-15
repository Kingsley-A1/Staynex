import { bulletList, renderEmailLayout } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { buildStaynexUrl, greeting } from "./email-template.utils";

export interface WelcomeEmailInput extends StaynexEmailInput { name?: string | null }

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const url = buildStaynexUrl(input.appOrigin, "/");
  return renderEmailLayout({
    subject: "Welcome to Staynex Bookings",
    preheader: "Your Staynex Bookings account is ready.",
    heading: "Welcome to Staynex Bookings",
    intro: `${greeting(input.name)} Your account is ready.`,
    bodyHtml: bulletList([
      "Search and compare trusted stays.",
      "Keep your bookings and confirmation details together.",
      "Pay through Staynex Bookings' secure booking flow.",
    ]),
    textBody: ["Search trusted stays, manage your bookings, and use the secure Staynex Bookings payment flow."],
    cta: { label: "Open Staynex Bookings", url },
    reason: "You received this email because a Staynex Bookings account was created with this email address.",
  });
}
