import { Injectable } from "@nestjs/common";
import { prisma } from "../../../db";
import type { VoucherVerification } from "../../../types";
import { iso, nightsOf } from "../bookings/util";
import { qrPngDataUrl, qrSvg } from "./qr";
import { renderVoucherPdf } from "./voucher-document";
import type { VoucherData } from "./voucher.types";

/**
 * Voucher authority: turns a payment reference into the one canonical
 * VoucherData, then renders it as the downloadable/attachable PDF or reduces it
 * to the public verification card reception scans. The reference (`stx_` + a
 * 128-bit UUID) is an unguessable capability token, so these reads are keyed by
 * it rather than the guessable booking id — the same model as an airline PNR.
 */
@Injectable()
export class VoucherService {
  /** {APP_URL}/verify/{reference} — the QR target and printed verify link. */
  verifyUrl(reference: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "https://staynexbookings.ng").replace(
      /\/+$/,
      "",
    );
    return `${base}/verify/${encodeURIComponent(reference)}`;
  }

  /** SVG QR for the on-page voucher. Deterministic from the reference alone. */
  qrSvg(reference: string): Promise<string> {
    return qrSvg(this.verifyUrl(reference));
  }

  /**
   * Render the canonical PDF. Returns null unless the booking is paid AND
   * confirmed — a receipt is only issued for money actually captured.
   */
  async renderPdf(reference: string): Promise<{ buffer: Buffer; filename: string } | null> {
    const data = await this.load(reference);
    if (!data || !data.paidAndConfirmed) return null;
    const qr = await qrPngDataUrl(data.verifyUrl);
    const buffer = await renderVoucherPdf(data, qr);
    return { buffer, filename: `staynex-booking-${reference}.pdf` };
  }

  /** Public, unauthenticated verification card — never exposes the amount. */
  async getVerification(reference: string): Promise<VoucherVerification> {
    const data = await this.load(reference);
    if (!data) return notFoundVerification(reference);
    return {
      valid: data.paidAndConfirmed,
      status: mapStatus(data.bookingStatus, data.paidAndConfirmed),
      reference: data.reference,
      guestName: data.guestName,
      guestEmailMasked: maskEmail(data.guestEmail),
      propertyName: data.propertyName,
      cityName: data.cityName,
      areaName: data.areaName,
      roomTypeName: data.roomTypeName,
      unitCode: data.unitCode,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights: data.nights,
      guests: { adults: data.adults, children: data.children, infants: data.infants },
      confirmedAt: data.paidAt,
    };
  }

  /** Load persisted rows and reduce to the canonical VoucherData (or null). */
  private async load(reference: string): Promise<VoucherData | null> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        booking: {
          include: {
            user: { select: { name: true, email: true } },
            roomUnit: {
              include: {
                roomType: {
                  include: {
                    property: {
                      include: {
                        city: { select: { name: true } },
                        area: { select: { name: true } },
                        ownerLocation: { select: { addressLine: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!payment) return null;

    const booking = payment.booking;
    const property = booking.roomUnit.roomType.property;
    const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut)).length;
    const amountKobo = payment.grossAmountKobo > 0 ? payment.grossAmountKobo : payment.amount;

    return {
      reference,
      paidAndConfirmed: booking.status === "CONFIRMED" && payment.status === "SUCCESS",
      bookingStatus: booking.status,
      guestName: booking.user?.name ?? null,
      guestEmail: booking.guestEmail ?? booking.user?.email ?? null,
      propertyName: property.name,
      cityName: property.city.name,
      areaName: property.area?.name ?? null,
      addressLine: property.ownerLocation?.addressLine ?? null,
      roomTypeName: booking.roomUnit.roomType.name,
      unitCode: booking.roomUnit.code ?? null,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      nights,
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants,
      amountKobo,
      currency: payment.currency,
      provider: payment.provider ?? null,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      verifyUrl: this.verifyUrl(reference),
    };
  }
}

function mapStatus(
  bookingStatus: string,
  paidAndConfirmed: boolean,
): VoucherVerification["status"] {
  if (paidAndConfirmed) return "CONFIRMED";
  if (bookingStatus === "CANCELLED" || bookingStatus === "EXPIRED") return "CANCELLED";
  return "PENDING";
}

function notFoundVerification(reference: string): VoucherVerification {
  return {
    valid: false,
    status: "NOT_FOUND",
    reference,
    guestName: null,
    guestEmailMasked: null,
    propertyName: null,
    cityName: null,
    areaName: null,
    roomTypeName: null,
    unitCode: null,
    checkIn: null,
    checkOut: null,
    nights: null,
    guests: null,
    confirmedAt: null,
  };
}

/** "john.doe@gmail.com" -> "jo•••@gmail.com"; keeps enough to match, hides the rest. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}•••${domain}`;
}
