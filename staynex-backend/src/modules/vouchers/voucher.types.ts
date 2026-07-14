/**
 * Canonical voucher shape — the single source of truth rendered into the PDF
 * (download + email attachment) and reduced into the public verification card.
 * Built once by VoucherService from persisted booking/payment/property rows.
 */
export interface VoucherData {
  reference: string;
  /** True only when the booking is CONFIRMED and its payment is SUCCESS. */
  paidAndConfirmed: boolean;
  bookingStatus: string;
  guestName: string | null;
  guestEmail: string | null;
  propertyName: string;
  cityName: string;
  areaName: string | null;
  /** Free-text street line when the owner recorded one; often null. */
  addressLine: string | null;
  roomTypeName: string;
  /** Internal unit code — provisional; the physical room is set at check-in. */
  unitCode: string | null;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  adults: number;
  children: number;
  infants: number;
  amountKobo: number;
  currency: string;
  provider: string | null;
  paidAt: string | null; // ISO
  /** {APP_URL}/verify/{reference} — encoded into the QR reception scans. */
  verifyUrl: string;
}
