import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { prisma } from "../../../db";
import type { AvailabilityDriftRow } from "../../../types";
import { addUtcDays, utcToday } from "../../common/dates";
import { readPositiveIntEnv } from "../../common/env";
import { NotificationsService } from "../notifications/notifications.service";
import { PENDING_BOOKING_TTL_MS } from "./bookings.service";
import { iso, nightsOf } from "./util";

const SWEEP_INTERVAL_MS = readPositiveIntEnv(
  "BOOKING_SWEEP_INTERVAL_MS",
  30_000,
);
const RECONCILE_INTERVAL_MS = readPositiveIntEnv(
  "AVAILABILITY_RECONCILE_INTERVAL_MS",
  6 * 60 * 60_000,
);
const REMINDER_INTERVAL_MS = readPositiveIntEnv(
  "CHECKIN_REMINDER_INTERVAL_MS",
  60 * 60_000,
);
const AVAILABILITY_REMINDER_INTERVAL_MS = readPositiveIntEnv(
  "AVAILABILITY_EXPIRY_REMINDER_INTERVAL_MS",
  60 * 60_000,
);
const RECONCILE_WINDOW_DAYS = 60;
const MAX_DRIFT_ROWS = 200;

/**
 * Background booking hygiene, off the request hot path (payment-review P7):
 *  - every ~30s: release expired holds and expire abandoned pending bookings
 *    (their held capacity returns to the pool; a late charge.success can still
 *    revive the booking via BookingsService.applyChargeSuccess);
 *  - every ~6h: reconcile availability counters against derived truth from
 *    live holds + open bookings, and alert on drift (P10). Reconciliation
 *    reports — it never silently rewrites counters.
 * Same interval pattern as PropertyAutoPublisherService.
 */
@Injectable()
export class BookingMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BookingMaintenanceService.name);
  private sweepTimer: NodeJS.Timeout | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private reminderTimer: NodeJS.Timeout | null = null;
  private availabilityReminderTimer: NodeJS.Timeout | null = null;
  private sweeping = false;
  private reconciling = false;
  private reminding = false;
  private remindingAvailability = false;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit(): void {
    if (process.env.BOOKING_SWEEP_DISABLED === "true") return;
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.reconcileTimer = setInterval(
      () => void this.reconcileAndLog(),
      RECONCILE_INTERVAL_MS,
    );
    this.reminderTimer = setInterval(
      () => void this.remindCheckIns(),
      REMINDER_INTERVAL_MS,
    );
    this.availabilityReminderTimer = setInterval(
      () => void this.remindAvailabilityExpiry(),
      AVAILABILITY_REMINDER_INTERVAL_MS,
    );
    void this.sweep();
    void this.remindAvailabilityExpiry();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    if (this.availabilityReminderTimer)
      clearInterval(this.availabilityReminderTimer);
  }

  /** Hourly: remind guests + hosts of tomorrow's arrivals (dedupe-idempotent). */
  private async remindCheckIns(): Promise<void> {
    if (this.reminding) return;
    this.reminding = true;
    try {
      const reminded = await this.notifications.sendCheckInReminders();
      if (reminded > 0)
        this.logger.log(`Check-in reminders sent for ${reminded} booking(s).`);
    } catch (err) {
      this.logger.error(
        `Check-in reminders failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      this.reminding = false;
    }
  }

  private async remindAvailabilityExpiry(): Promise<void> {
    if (this.remindingAvailability) return;
    this.remindingAvailability = true;
    try {
      const reminded =
        await this.notifications.sendAvailabilityExpiryReminders();
      if (reminded > 0) {
        this.logger.log(
          `Availability expiry reminders sent for ${reminded} property listing(s).`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Availability expiry reminders failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      this.remindingAvailability = false;
    }
  }

  /** Release expired holds and expire abandoned PENDING_PAYMENT bookings. */
  async sweep(): Promise<{ holdsReleased: number; bookingsExpired: number }> {
    if (this.sweeping) return { holdsReleased: 0, bookingsExpired: 0 };
    this.sweeping = true;
    try {
      const now = new Date();
      let holdsReleased = 0;
      let bookingsExpired = 0;

      const expiredHolds = await prisma.bookingHold.findMany({
        where: { expiresAt: { lt: now } },
        include: { roomUnit: { select: { roomTypeId: true } } },
      });
      for (const hold of expiredHolds) {
        const nights = nightsOf(iso(hold.checkIn), iso(hold.checkOut));
        await prisma.$transaction(async (tx) => {
          const deleted = await tx.bookingHold.deleteMany({
            where: { id: hold.id },
          });
          if (deleted.count === 0) return; // another sweeper/checkout consumed it
          await tx.availabilityCalendar.updateMany({
            where: {
              roomTypeId: hold.roomUnit.roomTypeId,
              date: { in: nights },
              heldUnits: { gt: 0 },
            },
            data: { heldUnits: { decrement: 1 } },
          });
          holdsReleased += 1;
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
          if (expired.count === 0) return; // confirmed/failed concurrently
          await tx.availabilityCalendar.updateMany({
            where: {
              roomTypeId: booking.roomUnit.roomTypeId,
              date: { in: nights },
              heldUnits: { gt: 0 },
            },
            data: { heldUnits: { decrement: 1 } },
          });
          // FAILED is not final for the money: a late charge.success on this
          // reference re-verifies and either revives the booking or lands in
          // the REQUIRES_REFUND exception queue (P1).
          if (booking.payment && booking.payment.status === "PENDING") {
            await tx.payment.update({
              where: { id: booking.payment.id },
              data: { status: "FAILED" },
            });
          }
          bookingsExpired += 1;
        });
      }

      if (holdsReleased > 0 || bookingsExpired > 0) {
        this.logger.log(
          `Booking sweep: holdsReleased=${holdsReleased} bookingsExpired=${bookingsExpired}.`,
        );
      }
      return { holdsReleased, bookingsExpired };
    } catch (err) {
      this.logger.error(
        `Booking sweep failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return { holdsReleased: 0, bookingsExpired: 0 };
    } finally {
      this.sweeping = false;
    }
  }

  /**
   * Compare calendar counters against derived truth for the next
   * `windowDays`: heldUnits should equal live holds + PENDING_PAYMENT
   * bookings covering the date; bookedUnits should equal CONFIRMED bookings.
   * Returns mismatches only (empty = clean books).
   */
  async reconcileAvailability(
    windowDays = RECONCILE_WINDOW_DAYS,
  ): Promise<AvailabilityDriftRow[]> {
    const now = new Date();
    const start = utcToday();
    const end = addUtcDays(start, windowDays);

    const [calendar, holds, bookings] = await Promise.all([
      prisma.availabilityCalendar.findMany({
        where: { date: { gte: start, lt: end } },
        select: {
          roomTypeId: true,
          date: true,
          totalUnits: true,
          heldUnits: true,
          bookedUnits: true,
          roomType: {
            select: { name: true, property: { select: { name: true } } },
          },
        },
      }),
      prisma.bookingHold.findMany({
        where: {
          expiresAt: { gt: now },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
        select: {
          checkIn: true,
          checkOut: true,
          roomUnit: { select: { roomTypeId: true } },
        },
      }),
      prisma.booking.findMany({
        where: {
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          roomUnit: { select: { roomTypeId: true } },
        },
      }),
    ]);

    // PENDING_PAYMENT bookings carry the hold's capacity until they confirm,
    // so they count toward heldUnits alongside live holds.
    const expectedHeld = new Map<string, number>();
    const expectedBooked = new Map<string, number>();
    const bump = (
      map: Map<string, number>,
      roomTypeId: string,
      checkIn: Date,
      checkOut: Date,
    ) => {
      for (const date of nightsOf(iso(checkIn), iso(checkOut))) {
        if (date < start || date >= end) continue;
        const key = `${roomTypeId}|${iso(date)}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    };
    for (const hold of holds) {
      bump(expectedHeld, hold.roomUnit.roomTypeId, hold.checkIn, hold.checkOut);
    }
    for (const booking of bookings) {
      const target =
        booking.status === "CONFIRMED" ? expectedBooked : expectedHeld;
      bump(
        target,
        booking.roomUnit.roomTypeId,
        booking.checkIn,
        booking.checkOut,
      );
    }

    const drift: AvailabilityDriftRow[] = [];
    for (const row of calendar) {
      const key = `${row.roomTypeId}|${iso(row.date)}`;
      const held = expectedHeld.get(key) ?? 0;
      const booked = expectedBooked.get(key) ?? 0;
      if (row.heldUnits !== held || row.bookedUnits !== booked) {
        drift.push({
          roomTypeId: row.roomTypeId,
          roomName: row.roomType.name,
          propertyName: row.roomType.property.name,
          date: iso(row.date),
          totalUnits: row.totalUnits,
          heldUnits: row.heldUnits,
          expectedHeldUnits: held,
          bookedUnits: row.bookedUnits,
          expectedBookedUnits: booked,
        });
        if (drift.length >= MAX_DRIFT_ROWS) break;
      }
    }
    return drift;
  }

  private async reconcileAndLog(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const drift = await this.reconcileAvailability();
      if (drift.length > 0) {
        this.logger.error(
          `AVAILABILITY DRIFT: ${drift.length} calendar day(s) disagree with live holds/bookings. ` +
            `First: ${drift[0].propertyName} / ${drift[0].roomName} on ${drift[0].date} ` +
            `(held ${drift[0].heldUnits} vs expected ${drift[0].expectedHeldUnits}, ` +
            `booked ${drift[0].bookedUnits} vs expected ${drift[0].expectedBookedUnits}).`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Availability reconciliation failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      this.reconciling = false;
    }
  }
}
