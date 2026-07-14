import type {
  EmailCta,
  EmailDetail,
  EmailStatusTone,
  RenderedEmail,
} from "./email-template.types";
import { escapeHtml, escapeHtmlAttribute, presentDetails, sanitizeSingleLine } from "./email-template.utils";

const COLORS: Record<EmailStatusTone, { foreground: string; background: string }> = {
  success: { foreground: "#15803D", background: "#ECFDF3" },
  warning: { foreground: "#8A5A12", background: "#FFF8E7" },
  error: { foreground: "#B42318", background: "#FEF3F2" },
  info: { foreground: "#27187D", background: "#F0EEFF" },
};

export interface EmailLayoutInput {
  subject: string;
  preheader: string;
  heading: string;
  intro: string;
  bodyHtml?: string;
  textBody?: string[];
  status?: { label: string; tone: EmailStatusTone };
  details?: EmailDetail[];
  cta?: EmailCta;
  support?: string;
  reason?: string;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#101014;font-size:15px;line-height:1.65;">${escapeHtml(text)}</p>`;
}

export function callout(title: string, text: string, tone: EmailStatusTone = "info"): string {
  const colors = COLORS[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:${colors.background};border-left:4px solid ${colors.foreground};"><tr><td style="padding:14px 16px;"><p style="margin:0 0 4px;color:${colors.foreground};font-size:14px;font-weight:700;">${escapeHtml(title)}</p><p style="margin:0;color:#101014;font-size:14px;line-height:1.55;">${escapeHtml(text)}</p></td></tr></table>`;
}

export function bulletList(items: string[]): string {
  const rows = items.filter((item) => item.trim()).map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join("");
  return rows ? `<ul style="margin:0 0 18px;padding-left:22px;color:#101014;font-size:15px;line-height:1.55;">${rows}</ul>` : "";
}

export function securityCode(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#F7F7FF;border:1px solid #E7E5F2;"><tr><td align="center" style="padding:20px 12px;"><span style="color:#27187D;font-size:32px;font-weight:800;letter-spacing:8px;line-height:1.2;">${escapeHtml(code)}</span></td></tr></table>`;
}

export function renderEmailLayout(input: EmailLayoutInput): RenderedEmail {
  const subject = (sanitizeSingleLine(input.subject) ?? "Staynex update")
    .replace(/</g, "‹")
    .replace(/>/g, "›");
  const details = presentDetails(input.details ?? []);
  const detailRows = details.map(({ label, value }) => `<tr><td valign="top" style="padding:10px 8px 10px 0;border-bottom:1px solid #E7E5F2;color:#6E6A83;font-size:13px;line-height:1.4;">${escapeHtml(label)}</td><td valign="top" align="right" style="padding:10px 0 10px 8px;border-bottom:1px solid #E7E5F2;color:#101014;font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere;">${escapeHtml(value)}</td></tr>`).join("");
  const detailTable = detailRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">${detailRows}</table>` : "";
  const status = input.status ? (() => {
    const colors = COLORS[input.status.tone];
    return `<p style="margin:0 0 14px;"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${colors.background};color:${colors.foreground};font-size:12px;font-weight:700;line-height:1.2;">${escapeHtml(input.status.label)}</span></p>`;
  })() : "";
  const cta = input.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td bgcolor="#27187D" style="border-radius:8px;"><a href="${escapeHtmlAttribute(input.cta.url)}" style="display:inline-block;min-height:44px;padding:13px 20px;box-sizing:border-box;color:#FFFFFF;font-size:15px;font-weight:700;line-height:18px;text-decoration:none;">${escapeHtml(input.cta.label)}</a></td></tr></table>` : "";
  const support = input.support ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#F7F7FF;border:1px solid #E7E5F2;"><tr><td style="padding:16px;"><p style="margin:0;color:#6E6A83;font-size:13px;line-height:1.55;">${escapeHtml(input.support)} <a href="mailto:support@staynexbookings.ng" style="color:#27187D;text-decoration:underline;">support@staynexbookings.ng</a></p></td></tr></table>` : "";
  const reason = input.reason ? `<p style="margin:22px 0 0;color:#6E6A83;font-size:12px;line-height:1.5;">${escapeHtml(input.reason)}</p>` : "";
  const preheader = escapeHtml(input.preheader);
  const plainDetails = details.map(({ label, value }) => `${label}: ${value}`);
  const text = [
    input.heading,
    "",
    input.intro,
    ...(input.status ? ["", `Status: ${input.status.label}`] : []),
    ...(input.textBody?.length ? ["", ...input.textBody] : []),
    ...(plainDetails.length ? ["", ...plainDetails] : []),
    ...(input.cta ? ["", `${input.cta.label}: ${input.cta.url}`] : []),
    ...(input.support ? ["", `${input.support} support@staynexbookings.ng`] : []),
    ...(input.reason ? ["", input.reason] : []),
    "",
    "Staynex — Book trusted stays, Confidently.",
  ].join("\n").replace(/</g, "‹").replace(/>/g, "›").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  return {
    subject,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#F7F7FF;font-family:Arial,Helvetica,sans-serif;color:#101014;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}&#847;&zwnj;&nbsp;&#8199;&shy;&nbsp;&#847;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#F7F7FF;"><tr><td align="center" style="padding:20px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td style="padding:8px 4px 20px;"><span style="color:#27187D;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Staynex</span></td></tr><tr><td style="background:#FFFFFF;border:1px solid #E7E5F2;border-radius:12px;padding:32px 28px;">${status}<h1 style="margin:0 0 14px;color:#101014;font-size:28px;line-height:1.2;letter-spacing:-0.4px;">${escapeHtml(input.heading)}</h1><p style="margin:0 0 18px;color:#101014;font-size:16px;line-height:1.6;">${escapeHtml(input.intro)}</p>${input.bodyHtml ?? ""}${detailTable}${cta}${support}${reason}</td></tr><tr><td style="padding:20px 4px 8px;text-align:center;"><p style="margin:0;color:#6E6A83;font-size:12px;line-height:1.5;">Staynex — Book trusted stays, Confidently.</p></td></tr></table></td></tr></table></body></html>`,
    text,
  };
}
