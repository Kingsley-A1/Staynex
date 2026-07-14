import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type { AvailabilityDay } from "../../../types";
import { PropertyReviewService } from "../property-review/property-review.service";
import type { SetCapacityInput } from "./dto";

function eachUtcDate(from: string, to: string): Date[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
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

  async setCapacity(
    ownerId: string,
    input: SetCapacityInput,
  ): Promise<{ updatedDays: number }> {
    const roomType = await this.assertOwnedRoomType(ownerId, input.roomTypeId);
    if (input.totalUnits > roomType.activeUnitCount) {
      throw new BadRequestException(
        `Availability cannot exceed the ${roomType.activeUnitCount} active room unit${roomType.activeUnitCount === 1 ? "" : "s"} configured for this room type.`,
      );
    }

    const days = eachUtcDate(input.from, input.to);
    const dateRange = { gte: days[0], lte: days[days.length - 1] };
    try {
      await prisma.$transaction(
        async (tx) => {
          const committed = await tx.availabilityCalendar.findMany({
            where: { roomTypeId: input.roomTypeId, date: dateRange },
            select: { date: true, bookedUnits: true, heldUnits: true },
          });
          const blockedDay = committed.find(
            (day) => day.bookedUnits + day.heldUnits > input.totalUnits,
          );
          if (blockedDay) {
            throw new ConflictException(
              `Capacity on ${blockedDay.date.toISOString().slice(0, 10)} cannot be lower than its existing bookings and holds.`,
            );
          }

          // Keep the interactive transaction bounded: create missing dates in
          // one query, then update the complete range in one query.
          await tx.availabilityCalendar.createMany({
            data: days.map((date) => ({
              roomTypeId: input.roomTypeId,
              date,
              totalUnits: input.totalUnits,
            })),
            skipDuplicates: true,
          });
          await tx.availabilityCalendar.updateMany({
            where: { roomTypeId: input.roomTypeId, date: dateRange },
            data: { totalUnits: input.totalUnits },
          });
        },
        { maxWait: 5_000, timeout: 15_000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException(
          "Availability changed while it was being saved. Please try again.",
        );
      }
      throw error;
    }
    await this.propertyReview.recordContentChange(roomType.propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    return { updatedDays: days.length };
  }

  async getCalendar(
    roomTypeId: string,
    from: string,
    to: string,
  ): Promise<AvailabilityDay[]> {
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
  ): Promise<{ id: string; propertyId: string; activeUnitCount: number }> {
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, property: { ownerId } },
      select: {
        id: true,
        propertyId: true,
        _count: { select: { roomUnits: { where: { isActive: true } } } },
      },
    });
    if (!roomType) throw new NotFoundException("Room type not found");
    return {
      id: roomType.id,
      propertyId: roomType.propertyId,
      activeUnitCount: roomType._count.roomUnits,
    };
  }
}
