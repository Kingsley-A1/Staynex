import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { BookingRow, OwnerBookingKpis, OwnerBookingsView } from "../../../types";
import { bookingRowInclude, toBookingRow } from "./report-mappers";

/**
 * Read-only owner booking reporting. Every query is scoped to the owner's own
 * properties (`roomUnit.roomType.property.ownerId`), so one owner can never see
 * another owner's bookings. No state mutation lives here.
 */
@Injectable()
export class BookingReportsService {
  /** Bookings for the owner's properties, plus headline KPIs. */
  async ownerView(ownerId: string): Promise<OwnerBookingsView> {
    const ownerScope = { roomUnit: { roomType: { property: { ownerId } } } } as const;

    const [rows, confirmedBookings, pendingPayments, activeUnits, earnings] = await Promise.all([
      prisma.booking.findMany({
        where: ownerScope,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: bookingRowInclude,
      }),
      prisma.booking.count({ where: { ...ownerScope, status: "CONFIRMED" } }),
      prisma.booking.count({ where: { ...ownerScope, status: "PENDING_PAYMENT" } }),
      prisma.roomUnit.count({
        where: { isActive: true, roomType: { property: { ownerId, status: "APPROVED" } } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "SUCCESS", booking: ownerScope },
      }),
    ]);

    const kpis: OwnerBookingKpis = {
      confirmedBookings,
      pendingPayments,
      availableRooms: activeUnits,
      estimatedEarningsKobo: earnings._sum.amount ?? 0,
      currency: "NGN",
    };

    return { kpis, bookings: rows.map(toBookingRow) };
  }

  /** A single booking, only if it belongs to the owner's properties. */
  async ownerBooking(ownerId: string, bookingId: string): Promise<BookingRow> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, roomUnit: { roomType: { property: { ownerId } } } },
      include: bookingRowInclude,
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return toBookingRow(booking);
  }
}
