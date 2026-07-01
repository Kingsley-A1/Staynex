import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { AvailabilityDay } from "../../../types";
import { PropertyReviewService } from "../property-review/property-review.service";
import type { SetCapacityInput } from "./dto";

function eachUtcDate(from: string, to: string): Date[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new BadRequestException("Invalid date range");
  }
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

/**
 * Availability v1: capacity per room type per day. The backend is the sole
 * authority for capacity; guest booking holds/bookings will decrement against
 * these rows in Phase 3.
 */
@Injectable()
export class AvailabilityService {
  constructor(private readonly propertyReview: PropertyReviewService) {}

  async setCapacity(ownerId: string, input: SetCapacityInput): Promise<{ updatedDays: number }> {
    const roomType = await this.assertOwnedRoomType(ownerId, input.roomTypeId);
    const days = eachUtcDate(input.from, input.to);
    await prisma.$transaction(
      days.map((date) =>
        prisma.availabilityCalendar.upsert({
          where: { roomTypeId_date: { roomTypeId: input.roomTypeId, date } },
          update: { totalUnits: input.totalUnits },
          create: { roomTypeId: input.roomTypeId, date, totalUnits: input.totalUnits },
        }),
      ),
    );
    await this.propertyReview.recordContentChange(roomType.propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    return { updatedDays: days.length };
  }

  async getCalendar(roomTypeId: string, from: string, to: string): Promise<AvailabilityDay[]> {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    const rows = await prisma.availabilityCalendar.findMany({
      where: { roomTypeId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      totalUnits: r.totalUnits,
      bookedUnits: r.bookedUnits,
      heldUnits: r.heldUnits,
      availableUnits: Math.max(0, r.totalUnits - r.bookedUnits - r.heldUnits),
    }));
  }

  private async assertOwnedRoomType(
    ownerId: string,
    roomTypeId: string,
  ): Promise<{ id: string; propertyId: string }> {
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, property: { ownerId } },
      select: { id: true, propertyId: true },
    });
    if (!roomType) throw new NotFoundException("Room type not found");
    return roomType;
  }
}
