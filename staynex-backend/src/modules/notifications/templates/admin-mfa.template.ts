import { callout, paragraph, renderEmailLayout, securityCode } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { greeting } from "./email-template.utils";

export interface AdminMfaEmailInput extends StaynexEmailInput {
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}

export function renderAdminMfaEmail(input: AdminMfaEmailInput): RenderedEmail {
  const expiry = `${input.expiresInMinutes} minutes`;
  return renderEmailLayout({
    subject: "Your Staynex Bookings Admin verification code",
    preheader: `Your Staynex Bookings Admin verification code expires in ${expiry}.`,
    heading: "Verify your admin sign-in",
    intro: greeting(input.name),
    bodyHtml: paragraph(`Use this code to finish signing in to Staynex Bookings Admin. It expires in ${expiry}.`) + securityCode(input.code) + callout("Keep this code private", "Staynex Bookings will never ask you to share this code. If you do not recognize this attempt, reset your password and contact platform support.", "warning"),
    textBody: [`Use this code to finish signing in to Staynex Bookings Admin. It expires in ${expiry}.`, "", input.code, "", "Keep this code private. If you do not recognize this attempt, reset your password and contact platform support."],
    support: "For help with an unrecognized admin sign-in, contact",
    reason: "You received this email because an admin sign-in was attempted for your Staynex Bookings account.",
  });
}
