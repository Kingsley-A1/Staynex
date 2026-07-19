function normalizeApiBase(input: string | undefined): string {
  const raw = input?.trim();
  if (!raw) return "http://localhost:4000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

/** Same-origin proxy path (see app/api/backend/[...path]/route.ts). Browser
 *  requests must go through here, never straight at API_BASE — the backend
 *  origin isn't guaranteed reachable/CORS-open from the guest's device, and
 *  the proxy is what every other client fetch already relies on. */
export const BROWSER_API_BASE = "/api/backend";

/** Voucher PDF link for the browser (also the exact bytes emailed as the
 *  attachment, fetched server-side via API_BASE there). */
export function voucherPdfUrl(reference: string): string {
  return `${BROWSER_API_BASE}/vouchers/${encodeURIComponent(reference)}/pdf`;
}

/** SVG QR the on-page voucher renders (points to /verify/<reference>). Same
 *  proxy path as the PDF link — a direct API_BASE URL broke this image for
 *  guests whenever the backend origin wasn't reachable/CORS-open from their
 *  device (e.g. mixed content on http-only API_BASE, or no CORS headers). */
export function voucherQrUrl(reference: string): string {
  return `${BROWSER_API_BASE}/vouchers/${encodeURIComponent(reference)}/qr.svg`;
}
