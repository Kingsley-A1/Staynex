import { Prisma } from "@prisma/client";
import type { AdminPaymentRow, BookingRow, BookingStatus, PaymentState } from "../../../types";
import { iso, nightsOf } from "./util";

// Shared query shapes + mappers for owner/admin booking & payment reporting, so
// both surfaces return identical row shapes (no duplicated mapping logic).

export const bookingRowInclude = Prisma.validator<Prisma.BookingInclude>()({
  payment: true,
  roomUnit: {
    include: {
      roomType: {
        include: { property: { include: { city: { select: { name: true } } } } },
      },
    },
  },
});
export type BookingRowData = Prisma.BookingGetPayload<{ include: typeof bookingRowInclude }>;

export function toBookingRow(b: BookingRowData): BookingRow {
  const roomType = b.roomUnit.roomType;
  const nights = nightsOf(iso(b.checkIn), iso(b.checkOut)).length;
  return {
    id: b.id,
    status: b.status as BookingStatus,
    propertyName: roomType.property.name,
    cityName: roomType.property.city.name,
    roomName: roomType.name,
    guestEmail: b.guestEmail,
    checkIn: iso(b.checkIn),
    checkOut: iso(b.checkOut),
    nights,
    amountKobo: b.payment?.amount ?? roomType.basePriceKobo * nights,
    currency: b.payment?.currency ?? "NGN",
    paymentStatus: (b.payment?.status ?? "PENDING") as PaymentState,
    paymentReference: b.payment?.reference ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

export const paymentRowInclude = Prisma.validator<Prisma.PaymentInclude>()({
  booking: {
    include: {
      roomUnit: { include: { roomType: { include: { property: { select: { name: true } } } } } },
    },
  },
});
export type PaymentRowData = Prisma.PaymentGetPayload<{ include: typeof paymentRowInclude }>;

export function toPaymentRow(p: PaymentRowData): AdminPaymentRow {
  return {
    reference: p.reference,
    bookingId: p.bookingId,
    propertyName: p.booking.roomUnit.roomType.property.name,
    amountKobo: p.amount,
    currency: p.currency,
    provider: p.provider,
    status: p.status as PaymentState,
    createdAt: p.createdAt.toISOString(),
  };
}
