export const SITE_NAME = "Staynex";
export const DEFAULT_SITE_URL = "https://staynexbookings.ng";

export const DEFAULT_DESCRIPTION =
  "Book verified hotels, apartments, and short-let stays across Nigeria with secure Paystack payments, real-time availability, and trusted guest support.";

export const SEO_KEYWORDS = [
  "Staynex",
  "hotel booking Nigeria",
  "verified stays Nigeria",
  "shortlet booking Nigeria",
  "Calabar hotels",
  "secure accommodation booking",
  "Paystack hotel payments",
];

export function getSiteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    DEFAULT_SITE_URL;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol.replace(/\/+$/, ""));
}

export function getSiteOrigin(): string {
  return getSiteUrl().toString().replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}

export const PUBLIC_SITEMAP_ROUTES = [
  "/",
  "/about",
  "/search",
  "/reviews",
  "/list-your-property",
  "/sign-in",
  "/register",
  "/owner/register",
  "/terms",
  "/policies",
  "/legal",
] as const;
