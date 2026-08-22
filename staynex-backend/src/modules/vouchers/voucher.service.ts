import { Injectable } from "@nestjs/common";
import { prisma } from "../../../db";
import type { VoucherVerification } from "../../../types";
import { iso, nightsOf } from "../bookings/util";
import { qrPngDataUrl, qrSvg } from "./qr";
import { renderVoucherPdf } from "./voucher-document";
import type { VoucherData } from "./voucher.types";

/** Builds private voucher documents and the minimal public verification view. */
@Injectable()
export class VoucherService {
  verifyUrl(reference: string): string {
    const base = (
      process.env.NEXT_PUBLIC_APP_URL || "https://staynexbookings.ng"
    ).replace(/\/+$/, "");
    return `${base}/verify/${encodeURIComponent(reference)}`;
  }

  qrSvg(reference: string): Promise<string> {
    return qrSvg(this.verifyUrl(reference));
  }

  async qrSvgForUser(reference: string, userId: string): Promise<string | null> {
    const owned = await prisma.payment.findFirst({
      where: { reference, booking: { userId } },
      select: { id: true },
    });
    return owned ? this.qrSvg(reference) : null;
  }

  /** Internal notification attachment path; the caller already owns the event. */
  renderPdf(
    reference: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    return this.renderPdfForOwner(reference);
  }

  /** Browser download path: the persisted booking owner is mandatory. */
  renderPdfForUser(
    reference: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    return this.renderPdfForOwner(reference, userId);
  }

  private async renderPdfForOwner(
    reference: string,
    userId?: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const data = await this.load(reference, userId);
    if (!data || !data.paidAndConfirmed) return null;
    const qr = await qrPngDataUrl(data.verifyUrl);
    const buffer = await renderVoucherPdf(data, qr);
    return { buffer, filename: `staynex-booking-${reference}.pdf` };
  }

  /** Public verification deliberately excludes guest identity and unit details. */
  async getVerification(reference: string): Promise<VoucherVerification> {
    const data = await this.load(reference);
    if (!data) return notFoundVerification(reference);
    return {
      validForCheckIn: data.mode === "LIVE" && data.paidAndConfirmed,
      status: mapStatus(data.bookingStatus, data.paidAndConfirmed, data.mode),
      reference: data.reference,
      mode: data.mode,
      propertyName: data.propertyName,
      cityName: data.cityName,
      roomTypeName: data.roomTypeName,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    };
  }

  private async load(
    reference: string,
    userId?: string,
  ): Promise<VoucherData | null> {
    const query = {
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
    } as const;

    const payment = userId
      ? await prisma.payment.findFirst({
          where: { reference, booking: { userId } },
          ...query,
        })
      : await prisma.payment.findUnique({ where: { reference }, ...query });
    if (!payment) return null;

    const booking = payment.booking;
    const property = booking.roomUnit.roomType.property;
    const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut)).length;
    const amountKobo =
      payment.grossAmountKobo > 0 ? payment.grossAmountKobo : payment.amount;

    return {
      reference,
      mode: payment.mode,
      paidAndConfirmed:
        booking.status === "CONFIRMED" && payment.status === "SUCCESS",
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
      provider: payment.provider,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      verifyUrl: this.verifyUrl(reference),
    };
  }
}

function mapStatus(
  bookingStatus: string,
  paidAndConfirmed: boolean,
  mode: "TEST" | "LIVE",
): VoucherVerification["status"] {
  if (mode === "TEST" && paidAndConfirmed) return "TEST";
  if (paidAndConfirmed) return "CONFIRMED";
  if (bookingStatus === "CANCELLED" || bookingStatus === "EXPIRED") {
    return "CANCELLED";
  }
  return "PENDING";
}

function notFoundVerification(reference: string): VoucherVerification {
  return {
    validForCheckIn: false,
    status: "NOT_FOUND",
    reference,
    mode: null,
    propertyName: null,
    cityName: null,
    roomTypeName: null,
    checkIn: null,
    checkOut: null,
  };
}
