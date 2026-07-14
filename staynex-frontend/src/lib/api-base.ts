function normalizeApiBase(input: string | undefined): string {
  const raw = input?.trim();
  if (!raw) return "http://localhost:4000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

/** Direct link to the canonical voucher PDF (also the email attachment). */
export function voucherPdfUrl(reference: string): string {
  return `${API_BASE}/vouchers/${encodeURIComponent(reference)}/pdf`;
}

/** SVG QR image the on-page voucher renders (points to /verify/<reference>). */
export function voucherQrUrl(reference: string): string {
  return `${API_BASE}/vouchers/${encodeURIComponent(reference)}/qr.svg`;
}
