import { Prisma } from "@prisma/client";
import type {
  AdminPaymentRow,
  AdminPayoutRow,
  BookingRow,
  BookingStatus,
  PaymentState,
  PayoutStatusValue,
} from "../../../types";
import { iso, nightsOf } from "./util";

// Shared query shapes + mappers for owner/admin booking & payment reporting, so
// both surfaces return identical row shapes (no duplicated mapping logic).

export const bookingRowInclude = Prisma.validator<Prisma.BookingInclude>()({
  payment: true,
  payout: { select: { status: true } },
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
  const payment = b.payment;
  // Prefer explicit accounting fields; fall back to the compat `amount`/base price
  // so pre-Phase-A rows still render coherently.
  const grossAmountKobo = payment
    ? payment.grossAmountKobo > 0
      ? payment.grossAmountKobo
      : payment.amount
    : roomType.basePriceKobo * nights;
  const platformFeeKobo = payment?.platformFeeKobo ?? 0;
  const ownerPayoutKobo = payment
    ? payment.ownerPayoutKobo > 0
      ? payment.ownerPayoutKobo
      : grossAmountKobo - platformFeeKobo
    : grossAmountKobo;
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
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    amountKobo: grossAmountKobo, // COMPAT: gross
    grossAmountKobo,
    platformFeeKobo,
    ownerPayoutKobo,
    currency: payment?.currency ?? "NGN",
    paymentStatus: (payment?.status ?? "PENDING") as PaymentState,
    paymentReference: payment?.reference ?? null,
    payoutStatus: (b.payout?.status ?? null) as PayoutStatusValue | null,
    createdAt: b.createdAt.toISOString(),
  };
}

export const paymentRowInclude = Prisma.validator<Prisma.PaymentInclude>()({
  payout: { select: { status: true } },
  booking: {
    include: {
      roomUnit: { include: { roomType: { include: { property: { select: { name: true } } } } } },
    },
  },
});
export type PaymentRowData = Prisma.PaymentGetPayload<{ include: typeof paymentRowInclude }>;

export function toPaymentRow(p: PaymentRowData): AdminPaymentRow {
  const grossAmountKobo = p.grossAmountKobo > 0 ? p.grossAmountKobo : p.amount;
  const ownerPayoutKobo = p.ownerPayoutKobo > 0 ? p.ownerPayoutKobo : grossAmountKobo - p.platformFeeKobo;
  return {
    reference: p.reference,
    bookingId: p.bookingId,
    propertyName: p.booking.roomUnit.roomType.property.name,
    amountKobo: grossAmountKobo, // COMPAT: gross
    grossAmountKobo,
    platformFeeKobo: p.platformFeeKobo,
    ownerPayoutKobo,
    currency: p.currency,
    provider: p.provider,
    status: p.status as PaymentState,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    payoutStatus: (p.payout?.status ?? null) as PayoutStatusValue | null,
    createdAt: p.createdAt.toISOString(),
  };
}

// --- Phase A: admin payout queue ---

export const payoutRowInclude = Prisma.validator<Prisma.PayoutInclude>()({
  payment: {
    select: {
      reference: true,
      grossAmountKobo: true,
      platformFeeKobo: true,
    },
  },
  property: { select: { name: true, city: { select: { name: true } } } },
  owner: { select: { name: true, email: true } },
});
export type PayoutRowData = Prisma.PayoutGetPayload<{ include: typeof payoutRowInclude }>;

export function toPayoutRow(p: PayoutRowData): AdminPayoutRow {
  return {
    id: p.id,
    bookingId: p.bookingId,
    paymentReference: p.payment.reference,
    propertyName: p.property.name,
    cityName: p.property.city.name,
    ownerName: p.owner.name,
    ownerEmail: p.owner.email,
    grossAmountKobo: p.payment.grossAmountKobo,
    platformFeeKobo: p.payment.platformFeeKobo,
    ownerPayoutKobo: p.amount,
    currency: p.currency,
    status: p.status as PayoutStatusValue,
    eligibleAt: p.eligibleAt.toISOString(),
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}
