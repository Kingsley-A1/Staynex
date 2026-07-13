import type { EmailDetail } from "./email-template.types";

const DEFAULT_APP_ORIGIN = "https://staynexbookings.ng";

export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

export function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function firstName(value: string | null | undefined): string | undefined {
  return optionalText(value)?.split(/\s+/)[0];
}

export function greeting(name?: string | null): string {
  const safeName = firstName(name);
  return safeName ? `Hi ${safeName},` : "Hi,";
}

export function getStaynexAppOrigin(
  configuredOrigin = process.env.NEXT_PUBLIC_APP_URL,
): string {
  return validateStaynexAppOrigin(configuredOrigin || DEFAULT_APP_ORIGIN);
}

export function validateStaynexAppOrigin(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute URL");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_APP_URL must use http or https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a clean application origin");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path) throw new Error("NEXT_PUBLIC_APP_URL must not contain a path");
  return url.origin;
}

export function buildStaynexUrl(appOrigin: string, internalPath: string): string {
  const origin = validateStaynexAppOrigin(appOrigin);
  if (!internalPath.startsWith("/") || internalPath.startsWith("//")) {
    throw new Error("Staynex email links must use a known internal path");
  }
  const url = new URL(internalPath, `${origin}/`);
  if (url.origin !== origin) throw new Error("Staynex email link changed origin");
  return url.toString();
}

export function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Email date is invalid");
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Email date/time is invalid");
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function formatAmount(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("Email amount must be a non-negative integer in minor units");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Email currency must be ISO 4217");
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function calculateNights(checkIn: Date | string, checkOut: Date | string): number {
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (!Number.isSafeInteger(nights) || nights < 1) throw new Error("Stay dates are invalid");
  return nights;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function presentDetails(details: EmailDetail[]): Array<{ label: string; value: string }> {
  return details.flatMap((detail) => {
    if (detail.value === null || detail.value === undefined) return [];
    const value = String(detail.value).trim();
    const label = detail.label.trim();
    return value && label ? [{ label, value }] : [];
  });
}

export function sanitizeSingleLine(value: string | null | undefined): string | undefined {
  const text = optionalText(value)?.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
  return text;
}
