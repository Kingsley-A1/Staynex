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
import {
  PaymentEventsService,
  type PaymentOutcomeResult,
} from "../payments/payment-events.service";
import { resolveCommissionBps, splitPayment } from "../payments/commission";
import type { CheckoutInput, QuoteInput } from "./dto";
import { iso, nightsOf } from "./util";

const CURRENCY = "NGN";
const HOLD_TTL_MS = 15 * 60_000; // booking holds expire after 15 minutes
export const PENDING_BOOKING_TTL_MS = 20 * 60_000; // abandoned pending payments release after 20 minutes
const PAYOUT_ELIGIBLE_AFTER_MS = 24 * 60 * 60_000; // owner payout becomes eligible 24h after check-in
const VERIFY_DEBOUNCE_MS = 15_000; // min gap between provider verifies per payment

// Booking rows include-shape shared by the success/failure/refund transitions.
const paymentWithBookingInclude = {
  booking: {
    include: {
      roomUnit: {
        include: {
          roomType: {
            select: { id: true, property: { select: { id: true, ownerId: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;
type PaymentWithBooking = Prisma.PaymentGetPayload<{
  include: typeof paymentWithBookingInclude;
}>;

/**
 * Booking-loop authority: availability, holds, checkout, and every
 * payment-driven state transition. The backend is the only place that mutates
 * availability counters or booking/payment status, and every transition
 * returns an explicit outcome so the caller can write the money audit trail —
 * nothing that touches funds resolves invisibly (payment-review P1).
 *
 * Stale-hold/stale-booking release runs in BookingMaintenanceService on an
 * interval, off the request hot path (P7).
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly paystack: PaystackService,
    private readonly notifications: NotificationsService,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  async quote(input: QuoteInput): Promise<AvailabilityQuote> {
    const roomType = await this.loadBookableRoomType(input.roomTypeId, input.guests);
    const nights = nightsOf(input.checkIn, input.checkOut);
    const available = await this.minAvailable(roomType.id, nights);
    return this.toQuote(roomType, input.checkIn, input.checkOut, nights.length, available);
  }

  /**
   * Place a hold: checks calendar capacity, allocates a room unit that is
   * genuinely free for the date range (P3 — `roomUnitId` is operational truth,
   * not a fixed placeholder), and snapshots the price so checkout charges what
   * the guest was quoted (P2).
   */
  async createHold(input: QuoteInput, guestUserId: string | null): Promise<HoldSummary> {
    const roomType = await this.loadBookableRoomType(input.roomTypeId, input.guests);
    const nights = nightsOf(input.checkIn, input.checkOut);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MS);
    const checkInDate = new Date(`${input.checkIn}T00:00:00.000Z`);
    const checkOutDate = new Date(`${input.checkOut}T00:00:00.000Z`);
    const nightlyPriceKobo = roomType.basePriceKobo;
    const totalKobo = nightlyPriceKobo * nights.length;

    const hold = await prisma.$transaction(
      async (tx) => {
        for (const date of nights) {
          const row = await tx.availabilityCalendar.findUnique({
            where: { roomTypeId_date: { roomTypeId: roomType.id, date } },
          });
          const available = row ? row.totalUnits - row.bookedUnits - row.heldUnits : 0;
          if (available < 1) {
            throw new ConflictException(`No availability on ${iso(date)}`);
          }
        }

        const unitId = await this.allocateFreeUnit(
          tx,
          roomType.id,
          checkInDate,
          checkOutDate,
          now,
        );

        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId: roomType.id, date: { in: nights } },
          data: { heldUnits: { increment: 1 } },
        });

        return tx.bookingHold.create({
          data: {
            roomUnitId: unitId,
            userId: guestUserId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            adults: input.adults,
            children: input.children,
            infants: input.infants,
            nightlyPriceKobo,
            totalKobo,
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
      { nightlyPriceKobo, totalKobo },
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
      this.holdPricing(hold, roomType.basePriceKobo, nights.length),
      hold.expiresAt,
      hold.expiresAt.getTime() < Date.now(),
    );
  }

  /** Convert a valid hold into a PENDING_PAYMENT booking + Paystack transaction. */
  async checkout(input: CheckoutInput, guestUserId: string | null): Promise<CheckoutResult> {
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

      // Charge the price snapshotted when the hold was created — a host price
      // edit mid-flow can never change what the guest was quoted (P2).
      const { totalKobo } = this.holdPricing(hold, roomType.basePriceKobo, nights.length);
      // Snapshot the commission split now so historical accounting is immutable
      // even if the platform rate later changes.
      const split = splitPayment(totalKobo, resolveCommissionBps());
      const booking = await tx.booking.create({
        data: {
          roomUnitId: hold.roomUnitId,
          userId: guestUserId ?? hold.userId,
          guestEmail: input.email,
          status: "PENDING_PAYMENT",
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          adults: hold.adults,
          children: hold.children,
          infants: hold.infants,
        },
      });
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: totalKobo, // COMPAT mirror of grossAmountKobo
          grossAmountKobo: split.grossAmountKobo,
          platformFeeKobo: split.platformFeeKobo,
          ownerPayoutKobo: split.ownerPayoutKobo,
          commissionRateBps: split.commissionRateBps,
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
      // Never leave a pending booking holding capacity if payment can't start —
      // and leave an audit row for the support ticket that follows.
      const result = await this.applyChargeFailure(reference);
      await this.paymentEvents.record({
        eventType: "checkout.init_failed",
        reference,
        outcome: result.outcome,
        detail: `Provider initialize failed: ${err instanceof Error ? err.message : "unknown"}.`,
      });
      throw err;
    }
  }

  // --- payment-driven transitions ------------------------------------------
  // Each returns an explicit outcome; callers persist it to the PaymentEvent
  // audit trail (webhook with raw payload, sync/admin without).

  /**
   * Apply a verified successful charge. Handles the full truth table:
   * normal confirmation, late success after expiry (revive or flag for refund
   * — P1), underpayment, and currency mismatch (P5). When the caller has no
   * amount (P6), the provider's verify API is consulted first.
   */
  async applyChargeSuccess(
    reference: string,
    paid: { amountKobo: number | null; currency: string | null },
  ): Promise<PaymentOutcomeResult> {
    let amountKobo = paid.amountKobo;
    let currency = paid.currency;
    if (amountKobo == null || currency == null) {
      // Missing amount OR currency — never confirm unvalidated. Verify with
      // the provider; a thrown error propagates so the webhook 500s and retries.
      const verified = await this.paystack.verifyTransaction(reference);
      if (verified.status !== "success") {
        return {
          outcome: "NO_CHANGE",
          detail: `Provider verify reports '${verified.status}' — not confirming.`,
        };
      }
      amountKobo = verified.amountKobo;
      currency = verified.currency;
    }

    const result = await prisma.$transaction(
      async (tx) => this.applySuccessTx(tx, reference, amountKobo, currency),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.confirmedBookingId) {
      // Best-effort: notification failures never undo a verified booking.
      await this.notifications.onBookingConfirmed(result.confirmedBookingId);
    }
    return { outcome: result.outcome, detail: result.detail };
  }

  /** Mark a payment failed and release any capacity its booking was holding. */
  async applyChargeFailure(reference: string): Promise<PaymentOutcomeResult> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: paymentWithBookingInclude,
      });
      if (!payment) return { outcome: "UNKNOWN_REFERENCE" };
      if (payment.status !== "PENDING" && payment.status !== "INITIATED") {
        return {
          outcome: "DUPLICATE",
          detail: `Payment already ${payment.status}; failure event ignored.`,
        };
      }

      await this.cancelPendingBooking(tx, payment);
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return { outcome: "MARKED_FAILED" };
    });
  }

  /**
   * Apply a refund (admin-initiated after the provider accepted it, or a
   * provider-side `refund.processed` event): payment -> REFUNDED, the booking
   * is cancelled with its capacity released, and an unsettled payout is
   * clawed back. A payout already PAID is flagged for out-of-band recovery.
   */
  async applyRefund(reference: string, initiatedBy: string): Promise<PaymentOutcomeResult> {
    const result = await prisma.$transaction(
      async (tx): Promise<PaymentOutcomeResult & { refundedBookingId?: string }> => {
      const payment = await tx.payment.findUnique({
        where: { reference },
        include: { ...paymentWithBookingInclude, payout: true },
      });
      if (!payment) return { outcome: "UNKNOWN_REFERENCE" };
      if (payment.status === "REFUNDED") {
        return { outcome: "DUPLICATE", detail: "Payment already refunded." };
      }

      const booking = payment.booking;
      const roomTypeId = booking.roomUnit.roomType.id;
      const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
      const details: string[] = [`Refund initiated by ${initiatedBy}.`];

      if (booking.status === "CONFIRMED") {
        await tx.availabilityCalendar.updateMany({
          where: { roomTypeId, date: { in: nights }, bookedUnits: { gt: 0 } },
          data: { bookedUnits: { decrement: 1 } },
        });
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
        details.push("Confirmed booking cancelled; capacity released.");
      } else if (booking.status === "PENDING_PAYMENT") {
        await this.cancelPendingBooking(tx, payment);
        details.push("Pending booking cancelled; held capacity released.");
      }

      if (payment.payout) {
        if (payment.payout.status === "PENDING" || payment.payout.status === "PROCESSING") {
          await tx.payout.update({
            where: { id: payment.payout.id },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              note: "Clawed back — payment refunded.",
            },
          });
          details.push("Unsettled payout clawed back.");
        } else if (payment.payout.status === "PAID") {
          details.push("WARNING: payout already PAID — recover from the host out of band.");
        }
      }

      await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      return {
        outcome: "REFUNDED",
        detail: details.join(" "),
        refundedBookingId: booking.id,
      };
      },
    );

    // Money moved back to the guest — tell them (and the host). Best-effort,
    // after commit, deduped by payment id.
    if (result.refundedBookingId) {
      await this.notifications.onPaymentRefunded(result.refundedBookingId);
    }
    return { outcome: result.outcome, detail: result.detail };
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

  /**
   * Reconcile one payment against the provider. Debounced per payment (P8) so
   * status-page polling can't hammer Paystack's verify API; `force` bypasses
   * the debounce for the audited admin re-verify action.
   */
  async syncPaymentStatus(reference: string, options: { force?: boolean } = {}): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      select: { id: true, status: true, lastVerifiedAt: true },
    });
    if (!payment) return;
    if (payment.status !== "PENDING" && payment.status !== "INITIATED") return;
    if (
      !options.force &&
      payment.lastVerifiedAt &&
      Date.now() - payment.lastVerifiedAt.getTime() < VERIFY_DEBOUNCE_MS
    ) {
      return;
    }
    // Claim the verify slot before the network call so concurrent polls
    // debounce against each other, not just against completed verifies.
    await prisma.payment.update({
      where: { id: payment.id },
      data: { lastVerifiedAt: new Date() },
    });

    try {
      const verified = await this.paystack.verifyTransaction(reference);
      if (verified.status === "success") {
        const result = await this.applyChargeSuccess(reference, {
          amountKobo: verified.amountKobo,
          currency: verified.currency,
        });
        if (result.outcome !== "NO_CHANGE" && result.outcome !== "DUPLICATE") {
          await this.paymentEvents.record({
            eventType: "sync.verify",
            reference,
            outcome: result.outcome,
            detail: result.detail,
          });
        }
        return;
      }
      if (["abandoned", "failed", "reversed"].includes(verified.status)) {
        const result = await this.applyChargeFailure(reference);
        if (result.outcome === "MARKED_FAILED") {
          await this.paymentEvents.record({
            eventType: "sync.verify",
            reference,
            outcome: result.outcome,
            detail: `Provider verify reports '${verified.status}'.`,
          });
        }
      }
    } catch (err) {
      this.logger.warn(
        `Payment status sync skipped for ${reference}: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
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
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants,
      amountKobo: booking.payment?.amount ?? roomType.basePriceKobo * nights,
      currency: booking.payment?.currency ?? CURRENCY,
      propertyName: roomType.property.name,
      propertySlug: roomType.property.slug,
      cityName: roomType.property.city.name,
      roomName: roomType.name,
      unitCode: booking.roomUnit.code ?? null,
      paymentStatus: (booking.payment?.status ?? "PENDING") as PaymentState,
      paymentReference: booking.payment?.reference ?? null,
    };
  }

  // --- internals ---------------------------------------------------------

  /** The success truth table, inside one serializable transaction. */
  private async applySuccessTx(
    tx: Prisma.TransactionClient,
    reference: string,
    amountKobo: number | null,
    currency: string | null,
  ): Promise<PaymentOutcomeResult & { confirmedBookingId?: string }> {
    const payment = await tx.payment.findUnique({
      where: { reference },
      include: paymentWithBookingInclude,
    });
    if (!payment) return { outcome: "UNKNOWN_REFERENCE" };
    if (payment.status === "SUCCESS" || payment.status === "REFUNDED") {
      return { outcome: "DUPLICATE", detail: `Payment already ${payment.status}.` };
    }
    if (payment.status === "REQUIRES_REFUND") {
      return { outcome: "DUPLICATE", detail: "Payment already flagged for refund." };
    }

    const booking = payment.booking;
    const roomTypeId = booking.roomUnit.roomType.id;
    const property = booking.roomUnit.roomType.property;
    const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
    // Prefer the canonical gross; fall back to the compat `amount` for pre-Phase-A rows.
    const expectedKobo = payment.grossAmountKobo > 0 ? payment.grossAmountKobo : payment.amount;

    // P5 — wrong currency: funds moved but the books can't reconcile it.
    if (currency && currency.toUpperCase() !== payment.currency.toUpperCase()) {
      await this.cancelPendingBooking(tx, payment);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REQUIRES_REFUND" },
      });
      return {
        outcome: "CURRENCY_MISMATCH",
        detail: `Charged in ${currency}, expected ${payment.currency}. Needs manual refund.`,
      };
    }

    // Underpaid: funds captured but less than owed — never confirms, and the
    // captured money must be visible for refund (not silently FAILED).
    if (amountKobo != null && amountKobo < expectedKobo) {
      await this.cancelPendingBooking(tx, payment);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REQUIRES_REFUND" },
      });
      return {
        outcome: "UNDERPAID",
        detail: `Charged ${amountKobo} kobo of ${expectedKobo} expected. Needs manual refund.`,
      };
    }

    if (booking.status === "PENDING_PAYMENT") {
      await tx.availabilityCalendar.updateMany({
        where: { roomTypeId, date: { in: nights }, heldUnits: { gt: 0 } },
        data: { heldUnits: { decrement: 1 }, bookedUnits: { increment: 1 } },
      });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
      await this.settlePayment(tx, payment, property.ownerId, property.id, expectedKobo);
      return { outcome: "CONFIRMED", confirmedBookingId: booking.id };
    }

    if (booking.status === "EXPIRED" || booking.status === "CANCELLED") {
      // P1 — late success (slow bank transfer/USSD, webhook retries). The held
      // capacity is long released; re-book only if every night is still free.
      const rows = await tx.availabilityCalendar.findMany({
        where: { roomTypeId, date: { in: nights } },
      });
      const bookable =
        rows.length === nights.length &&
        rows.every((row) => row.totalUnits - row.bookedUnits - row.heldUnits >= 1);

      if (!bookable) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REQUIRES_REFUND" },
        });
        return {
          outcome: "REQUIRES_REFUND",
          detail: "Paid after expiry and the dates are no longer available. Needs manual refund.",
        };
      }

      await tx.availabilityCalendar.updateMany({
        where: { roomTypeId, date: { in: nights } },
        data: { bookedUnits: { increment: 1 } },
      });
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
      await this.settlePayment(tx, payment, property.ownerId, property.id, expectedKobo);
      return {
        outcome: "REVIVED",
        confirmedBookingId: booking.id,
        detail: "Late success — capacity still free, booking re-confirmed.",
      };
    }

    if (booking.status === "CONFIRMED") {
      // Booking confirmed but the payment row lagged (crash between updates,
      // or duplicate delivery racing) — heal the payment side idempotently.
      await this.settlePayment(tx, payment, property.ownerId, property.id, expectedKobo);
      return {
        outcome: "CONFIRMED",
        detail: "Payment state healed to match already-confirmed booking.",
      };
    }

    return { outcome: "NO_CHANGE", detail: `Unhandled booking status ${booking.status}.` };
  }

  /** Payment -> SUCCESS plus the idempotent owner-settlement payout. */
  private async settlePayment(
    tx: Prisma.TransactionClient,
    payment: PaymentWithBooking,
    ownerId: string,
    propertyId: string,
    expectedKobo: number,
  ): Promise<void> {
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: now, lastVerifiedAt: now },
    });
    // One PENDING payout per successful payment, eligible 24h after check-in.
    // `upsert` on the unique paymentId keeps this idempotent under webhook +
    // status-sync double delivery.
    const ownerPayoutKobo =
      payment.ownerPayoutKobo > 0
        ? payment.ownerPayoutKobo
        : splitPayment(expectedKobo, payment.commissionRateBps || resolveCommissionBps())
            .ownerPayoutKobo;
    await tx.payout.upsert({
      where: { paymentId: payment.id },
      create: {
        bookingId: payment.booking.id,
        paymentId: payment.id,
        ownerId,
        propertyId,
        amount: ownerPayoutKobo,
        currency: payment.currency,
        status: "PENDING",
        eligibleAt: new Date(payment.booking.checkIn.getTime() + PAYOUT_ELIGIBLE_AFTER_MS),
      },
      update: {},
    });
  }

  /** Cancel a PENDING_PAYMENT booking and release its held capacity. No-op otherwise. */
  private async cancelPendingBooking(
    tx: Prisma.TransactionClient,
    payment: PaymentWithBooking,
  ): Promise<void> {
    const booking = payment.booking;
    if (booking.status !== "PENDING_PAYMENT") return;
    const nights = nightsOf(iso(booking.checkIn), iso(booking.checkOut));
    await tx.availabilityCalendar.updateMany({
      where: {
        roomTypeId: booking.roomUnit.roomType.id,
        date: { in: nights },
        heldUnits: { gt: 0 },
      },
      data: { heldUnits: { decrement: 1 } },
    });
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  }

  /**
   * Pick an active unit with no overlapping live hold or open booking, so a
   * booking's `roomUnitId` names a room the guest can actually occupy (P3).
   * The calendar remains the capacity authority; if it says space exists but
   * no unit is free, the counters have drifted — refuse rather than lie.
   */
  private async allocateFreeUnit(
    tx: Prisma.TransactionClient,
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
    now: Date,
  ): Promise<string> {
    const units = await tx.roomUnit.findMany({
      where: { roomTypeId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (units.length === 0) throw new ConflictException("No bookable units for this room");

    const unitIds = units.map((u) => u.id);
    const overlap = { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } };
    const [busyHolds, busyBookings] = await Promise.all([
      tx.bookingHold.findMany({
        where: { roomUnitId: { in: unitIds }, expiresAt: { gt: now }, ...overlap },
        select: { roomUnitId: true },
      }),
      tx.booking.findMany({
        where: {
          roomUnitId: { in: unitIds },
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          ...overlap,
        },
        select: { roomUnitId: true },
      }),
    ]);
    const busy = new Set([...busyHolds, ...busyBookings].map((r) => r.roomUnitId));
    const free = units.find((u) => !busy.has(u.id));
    if (!free) {
      throw new ConflictException("No room is free for those dates — please adjust your dates.");
    }
    return free.id;
  }

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

  /** Snapshot pricing from the hold; legacy rows (0) fall back to live price. */
  private holdPricing(
    hold: { nightlyPriceKobo: number; totalKobo: number },
    basePriceKobo: number,
    nightCount: number,
  ): { nightlyPriceKobo: number; totalKobo: number } {
    if (hold.totalKobo > 0) {
      return { nightlyPriceKobo: hold.nightlyPriceKobo, totalKobo: hold.totalKobo };
    }
    return { nightlyPriceKobo: basePriceKobo, totalKobo: basePriceKobo * nightCount };
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
    roomType: { id: string; name: string; property: { name: string } },
    checkIn: string,
    checkOut: string,
    nights: number,
    pricing: { nightlyPriceKobo: number; totalKobo: number },
    expiresAt: Date,
    expired: boolean,
  ): HoldSummary {
    return {
      holdId,
      roomTypeId: roomType.id,
      propertyName: roomType.property.name,
      roomName: roomType.name,
      checkIn,
      checkOut,
      nights,
      nightlyPriceKobo: pricing.nightlyPriceKobo,
      totalKobo: pricing.totalKobo,
      currency: CURRENCY,
      expiresAt: expiresAt.toISOString(),
      expired,
    };
  }
}
