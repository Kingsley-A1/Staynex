import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../db";
import type {
  AvailabilityQuote,
  BookingStatus,
  BookingView,
  CheckoutResult,
  HoldSummary,
  PaymentState,
  PaymentStatusView,
} from "../../../types";
import { NotificationsService } from "../notifications/notifications.service";
import { PaystackService } from "../payments/paystack.service";
import type { CheckoutInput, QuoteInput } from "./dto";
import { iso, nightsOf } from "./util";

const CURRENCY = "NGN";
const HOLD_TTL_MS = 15 * 60_000; // booking holds expire after 15 minutes
const PENDING_BOOKING_TTL_MS = 20 * 60_000; // abandoned pending payments release after 20 minutes

/**
 * Booking-loop authority: availability, holds, checkout, and the
 * webhook-driven confirm/fail transitions. The backend is the only place that
 * mutates availability counters or booking/payment status.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly paystack: PaystackService,
    private readonly notifications: NotificationsService,
  ) {}

  async quote(input: QuoteInput): Promise<AvailabilityQuote> {
    await this.releaseStale();
    const roomType = await this.loadBookableRoomType(input.roomTypeId, input.guests);
    const nights = nightsOf(input.checkIn, input.checkOut);
    const available = await this.minAvailable(roomType.id, nights);
    return this.toQuote(roomType, input.checkIn, input.checkOut, nights.length, available);
  }

  async createHold(input: QuoteInput, guestUserId: string | null): Promise<HoldSummary> {
    await this.releaseStale();
    const roomType = await this.loadBookableRoomType(input.roomTypeId, input.guests);
    const nights = nightsOf(input.checkIn, input.checkOut);
    const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

    const hold = await prisma.$transaction(
      async (tx) => {
        const unit = await tx.roomUnit.findFirst({
          where: { roomTypeId: roomType.id, isActive: true },
          select: { id: true },
        });
        if (!unit) throw new ConflictException("No bookable units for this room");

        for (const date of nights) {
          const row = await tx.availabilityCalendar.findUnique({
            where: { roomTypeId_date: { roomTypeId: roomType.id, date } },
          });
          const available = row ? row.totalUnits - row.bookedUnits - row.heldUnits : 0;
          if (available < 1) {
            throw new ConflictException(`No availability on ${iso(date)}`);
          }
        }

        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: roomType.id, date: { in: nights } },
          data: { heldUnits: { increment: 1 } },
        });

        return tx.bookingHold.create({
          data: {
            roomUnitId: unit.id,
            userId: guestUserId,
            checkIn: new Date(`${input.checkIn}T00:00:00.000Z`),
            checkOut: new Date(`${input.checkOut}T00:00:00.000Z`),
            expiresAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toHoldSummary(
      hold.id,
      roomType,
      input.checkIn,
      input.checkOut,
      nights.length,
      expiresAt,
      false,
    );
  }

  async getHold(holdId: string): Promise<HoldSummary> {
    const hold = await prisma.bookingHold.findUnique({
      where: { id: holdId },
      include: { roomUnit: { include: { roomType: { include: { property: true } } } } },
    });
    if (!hold) throw new NotFoundException("Hold not found");
    const roomType = hold.roomUnit.roomType;
    const nights = nightsOf(iso(hold.checkIn), iso(hold.checkOut));
    return this.toHoldSummary(
      hold.id,
      roomType,
      iso(hold.checkIn),
      iso(hold.checkOut),
      nights.length,
      hold.expiresAt,
      hold.expiresAt.getTime() < Date.now(),
    );
  }

  /** Convert a valid hold into a PENDING_PAYMENT booking + Paystack transaction. */
  async checkout(input: CheckoutInput, guestUserId: string | null): Promise<CheckoutResult> {
    await this.releaseStale();
    const reference = `stx_${randomUUID().replace(/-/g, "")}`;

    const prepared = await prisma.$transaction(async (tx) => {
      const hold = await tx.bookingHold.findUnique({
        where: { id: input.holdId },
        include: { roomUnit: { include: { roomType: { include: { property: true } } } } },
      });
      if (!hold) throw new NotFoundException("Hold not found");

      const nights = nightsOf(iso(hold.checkIn), iso(hold.checkOut));
      const roomType = hold.roomUnit.roomType;

      if (hold.expiresAt.getTime() < Date.now()) {
        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: roomType.id, date: { in: nights }, heldUnits: { gt: 0 } },
          data: { heldUnits: { decrement: 1 } },
        });
        await tx.bookingHold.delete({ where: { id: hold.id } });
        throw new ConflictException("Hold expired");
      }
      if (roomType.property.status !== "APPROVED") {
        throw new ConflictException("Property is not bookable");
      }

      const totalKobo = roomType.basePriceKobo * nights.length;
      const booking = await tx.booking.create({
        data: {
          roomUnitId: hold.roomUnitId,
          userId: guestUserId ?? hold.userId,
          guestEmail: input.email,
          status: "PENDING_PAYMENT",
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
        },
      });
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: totalKobo,
          currency: CURRENCY,
          provider: "paystack",
          reference,
          status: "PENDING",
        },
      });
      // Held capacity carries over to the pending booking; the hold row is consumed.
      await tx.bookingHold.delete({ where: { id: hold.id } });
      return { bookingId: booking.id, totalKobo };
    });

    try {
      const init = await this.paystack.initializeTransaction({
        email: input.email,
        amountKobo: prepared.totalKobo,
        reference,
        metadata: { bookingId: prepared.bookingId },
      });
      return { bookingId: prepared.bookingId, reference, authorizationUrl: init.authorizationUrl };
    } catch (err) {
      // Never leave a pending booking holding capacity if payment can't start.
      await this.failByReference(reference);
      throw err;
    }
  }

  /** Webhook: confirm a verified successful payment + its booking, transactionally. */
  async confirmByReference(reference: string, paidAmountKobo: number | null): Promise<void> {
    const confirmedBookingId = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { booking: { include: { roomUnit: { select: { roomTypeId: true } } } } },
      });
      if (!payment) return null; // unknown reference — ignore
      if (payment.status === "SUCCESS") return null; // idempotent
      if (payment.status !== "PENDING" && payment.status !== "INITIATED") return null;

      const booking = payment.booking;
      if (booking.status !== "PENDING_PAYMENT") return null;

      const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
      const underpaid = paidAmountKobo != null && paidAmountKobo < payment.amount;

      if (underpaid) {
        if (booking.status === "PENDING_PAYMENT") {
          await tx.availabilityCalendar.updateMany({
            where: { roomTypeId: booking.roomUnit.roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
            data: { heldUnits: { decrement: 1 } },
          });
          await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
        }
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        return null;
      }

      await tx.availabilityCalendar.updateMany({
        where: { roomTypeId: booking.roomUnit.roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
        data: { heldUnits: { decrement: 1 }, bookedUnits: { increment: 1 } },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
      return booking.id;
    });

    // Notify only on the real PENDING_PAYMENT -> CONFIRMED transition, after the
    // transaction commits. Best-effort: notification failures never undo a
    // verified booking. The notifications service re-checks SUCCESS/CONFIRMED.
    if (confirmedBookingId) {
      await this.notifications.onBookingConfirmed(confirmedBookingId);
    }
  }

  /** Mark a payment failed and release any capacity its booking was holding. */
  async failByReference(reference: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { booking: { include: { roomUnit: { select: { roomTypeId: true } } } } },
      });
      if (!payment) return;
      if (payment.status === "SUCCESS" || payment.status === "FAILED") return;

      const booking = payment.booking;
      if (booking.status === "PENDING_PAYMENT") {
        const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: booking.roomUnit.roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
          data: { heldUnits: { decrement: 1 } },
        });
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    });
  }

  async getPaymentStatus(reference: string): Promise<PaymentStatusView> {
    await this.syncPaymentStatus(reference);
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { booking: { select: { id: true, status: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return {
      reference,
      paymentStatus: payment.status as PaymentState,
      bookingId: payment.bookingId,
      bookingStatus: payment.booking.status as BookingStatus,
    };
  }

  async getBooking(bookingId: string): Promise<BookingView> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        roomUnit: {
          include: { roomType: { include: { property: { include: { city: { select: { name: true } } } } } } },
        },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");

    const roomType = booking.roomUnit.roomType;
    const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut)).length;
    return {
      id: booking.id,
      status: booking.status as BookingStatus,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      nights,
      amountKobo: booking.payment?.amount ?? roomType.basePriceKobo * nights,
      currency: booking.payment?.currency ?? CURRENCY,
      propertyName: roomType.property.name,
      propertySlug: roomType.property.slug,
      cityName: roomType.property.city.name,
      roomName: roomType.name,
      paymentStatus: (booking.payment?.status ?? "PENDING") as PaymentState,
      paymentReference: booking.payment?.reference ?? null,
    };
  }

  // --- internals ---------------------------------------------------------

  private async loadBookableRoomType(roomTypeId: string, guests: number) {
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, property: { status: "APPROVED" } },
      include: { property: true },
    });
    if (!roomType) throw new NotFoundException("Room not found or not bookable");
    if (guests > roomType.maxGuests) {
      throw new BadRequestException(`This room allows up to ${roomType.maxGuests} guests`);
    }
    return roomType;
  }

  private async minAvailable(roomTypeId: string, nights: Date[]): Promise<number> {
    const rows = await prisma.availabilityCalendar.findMany({
      where: { roomTypeId, date: { in: nights } },
    });
    if (rows.length < nights.length) return 0; // a night without a capacity row = not available
    let min = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      min = Math.min(min, row.totalUnits - row.bookedUnits - row.heldUnits);
    }
    return Number.isFinite(min) ? Math.max(0, min) : 0;
  }

  private async syncPaymentStatus(reference: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      select: { status: true },
    });
    if (!payment || payment.status === "SUCCESS" || payment.status === "FAILED") return;

    try {
      const verified = await this.paystack.verifyTransaction(reference);
      if (verified.status === "success") {
        await this.confirmByReference(reference, verified.amountKobo);
        return;
      }
      if (["abandoned", "failed", "reversed"].includes(verified.status)) {
        await this.failByReference(reference);
      }
    } catch (err) {
      this.logger.warn(
        `Payment status sync skipped for ${reference}: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  /** Lazily release expired holds and abandoned pending bookings (no scheduler in POC). */
  private async releaseStale(): Promise<void> {
    const now = new Date();

    const expiredHolds = await prisma.bookingHold.findMany({
      where: { expiresAt: { lt: now } },
      include: { roomUnit: { select: { roomTypeId: true } } },
    });
    for (const hold of expiredHolds) {
      const nights = nightsOf(iso(hold.checkIn), iso(hold.checkOut));
      await prisma.$transaction(async (tx) => {
        const deleted = await tx.bookingHold.deleteMany({ where: { id: hold.id } });
        if (deleted.count === 0) return;
        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: hold.roomUnit.roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
          data: { heldUnits: { decrement: 1 } },
        });
      });
    }

    const cutoff = new Date(Date.now() - PENDING_BOOKING_TTL_MS);
    const stale = await prisma.booking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
      include: { roomUnit: { select: { roomTypeId: true } }, payment: true },
    });
    for (const booking of stale) {
      const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
      await prisma.$transaction(async (tx) => {
        const expired = await tx.booking.updateMany({
          where: { id: booking.id, status: "PENDING_PAYMENT" },
          data: { status: "EXPIRED" },
        });
        if (expired.count === 0) return;
        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: booking.roomUnit.roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
          data: { heldUnits: { decrement: 1 } },
        });
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: "FAILED" },
          });
        }
      });
    }
  }

  private toQuote(
    roomType: { id: string; name: string; basePriceKobo: number; property: { name: string } },
    checkIn: string,
    checkOut: string,
    nights: number,
    available: number,
  ): AvailabilityQuote {
    const nightlyPriceKobo = roomType.basePriceKobo;
    return {
      roomTypeId: roomType.id,
      propertyName: roomType.property.name,
      roomName: roomType.name,
      checkIn,
      checkOut,
      nights,
      available,
      nightlyPriceKobo,
      totalKobo: nightlyPriceKobo * nights,
      currency: CURRENCY,
    };
  }

  private toHoldSummary(
    holdId: string,
    roomType: { id: string; name: string; basePriceKobo: number; property: { name: string } },
    checkIn: string,
    checkOut: string,
    nights: number,
    expiresAt: Date,
    expired: boolean,
  ): HoldSummary {
    const nightlyPriceKobo = roomType.basePriceKobo;
    return {
      holdId,
      roomTypeId: roomType.id,
      propertyName: roomType.property.name,
      roomName: roomType.name,
      checkIn,
      checkOut,
      nights,
      nightlyPriceKobo,
      totalKobo: nightlyPriceKobo * nights,
      currency: CURRENCY,
      expiresAt: expiresAt.toISOString(),
      expired,
    };
  }
}
