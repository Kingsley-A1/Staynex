import { callout, paragraph, renderEmailLayout, securityCode } from "./email-layout";
import type { RenderedEmail, StaynexEmailInput } from "./email-template.types";
import { greeting } from "./email-template.utils";

export interface PasswordResetEmailInput extends StaynexEmailInput {
  name?: string | null;
  code: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const expiry = `${input.expiresInMinutes} minutes`;
  return renderEmailLayout({
    subject: "Your Staynex password reset code",
    preheader: `Your single-use password reset code expires in ${expiry}.`,
    heading: "Reset your password",
    intro: greeting(input.name),
    bodyHtml: paragraph(`Enter this single-use code on the Staynex password reset page. It expires in ${expiry}.`) + securityCode(input.code) + callout("Didn't request this?", "You can safely ignore this email. Your password has not changed. Never share this code with anyone.", "warning"),
    textBody: [`Enter this single-use code on the Staynex password reset page. It expires in ${expiry}.`, "", input.code, "", "If you did not request this, ignore this email. Your password has not changed. Never share this code."],
    reason: "You received this email because a password reset was requested for your Staynex account.",
  });
}
