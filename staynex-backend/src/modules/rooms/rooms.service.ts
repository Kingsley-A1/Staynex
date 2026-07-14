import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import type {
  CreateRoomTypeInput,
  CreateRoomUnitInput,
  UpdateRoomTypeInput,
} from "./dto";
import { PropertyReviewService } from "../property-review/property-review.service";

/** Owner room-type and room-unit setup for a property. */
@Injectable()
export class RoomsService {
  constructor(private readonly propertyReview: PropertyReviewService) {}

  async listRoomTypes(ownerId: string, propertyId: string) {
    await this.assertOwnedProperty(ownerId, propertyId);
    return prisma.roomType.findMany({
      where: { propertyId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { roomUnits: { where: { isActive: true } } },
        },
      },
    });
  }

  async createRoomType(ownerId: string, input: CreateRoomTypeInput) {
    await this.assertOwnedProperty(ownerId, input.propertyId);
    const roomType = await prisma.roomType.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        description: input.description ?? null,
        basePriceKobo: input.basePriceKobo,
        maxGuests: input.maxGuests,
      },
    });
    await this.propertyReview.recordContentChange(input.propertyId, { actorUserId: ownerId });
    return roomType;
  }

  async updateRoomType(ownerId: string, id: string, input: UpdateRoomTypeInput) {
    const roomType = await this.assertOwnedRoomType(ownerId, id);
    if (!hasDefinedValue(input)) {
      return prisma.roomType.findUniqueOrThrow({ where: { id } });
    }
    const updated = await prisma.roomType.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        basePriceKobo: input.basePriceKobo,
        maxGuests: input.maxGuests,
      },
    });
    await this.propertyReview.recordContentChange(roomType.propertyId, { actorUserId: ownerId });
    return updated;
  }

  async listRoomUnits(ownerId: string, roomTypeId: string) {
    await this.assertOwnedRoomType(ownerId, roomTypeId);
    return prisma.roomUnit.findMany({
      where: { roomTypeId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async addRoomUnit(ownerId: string, input: CreateRoomUnitInput) {
    const roomType = await this.assertOwnedRoomType(ownerId, input.roomTypeId);
    const roomUnit = await prisma.roomUnit.create({
      data: { roomTypeId: input.roomTypeId, code: input.code ?? null },
    });
    await this.propertyReview.recordContentChange(roomType.propertyId, { actorUserId: ownerId });
    return roomUnit;
  }

  /**
   * Reduce a room type's physical inventory by one without breaking a live
   * hold, future/current booking, or nightly capacity invariant. Historical
   * unit relations remain intact because the unit is deactivated, not deleted.
   */
  async deactivateOneRoomUnit(
    ownerId: string,
    roomTypeId: string,
  ): Promise<{ unitCount: number }> {
    const roomType = await this.assertOwnedRoomType(ownerId, roomTypeId);
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const activeCount = await tx.roomUnit.count({
            where: { roomTypeId, isActive: true },
          });
          if (activeCount === 0) {
            throw new ConflictException("This room type has no active units to remove.");
          }

          const removable = await tx.roomUnit.findFirst({
            where: {
              roomTypeId,
              isActive: true,
              bookingHolds: { none: { expiresAt: { gt: now } } },
              bookings: {
                none: {
                  checkOut: { gt: today },
                  status: { in: ["HOLD", "PENDING_PAYMENT", "CONFIRMED"] },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          if (!removable) {
            throw new ConflictException(
              "Every active unit is attached to a current booking or hold. Remove a unit after those stays are complete.",
            );
          }

          const unitCount = activeCount - 1;
          const futureCapacity = await tx.availabilityCalendar.findMany({
            where: { roomTypeId, date: { gte: today } },
            select: { date: true, bookedUnits: true, heldUnits: true },
          });
          const blockedNight = futureCapacity.find(
            (day) => day.bookedUnits + day.heldUnits > unitCount,
          );
          if (blockedNight) {
            throw new ConflictException(
              `A unit cannot be removed because ${blockedNight.date.toISOString().slice(0, 10)} already has ${blockedNight.bookedUnits + blockedNight.heldUnits} committed room${blockedNight.bookedUnits + blockedNight.heldUnits === 1 ? "" : "s"}.`,
            );
          }

          await tx.roomUnit.update({
            where: { id: removable.id },
            data: { isActive: false },
          });
          await tx.availabilityCalendar.updateMany({
            where: {
              roomTypeId,
              date: { gte: today },
              totalUnits: { gt: unitCount },
            },
            data: { totalUnits: unitCount },
          });
          return { unitCount };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );

      await this.propertyReview.recordContentChange(roomType.propertyId, {
        actorUserId: ownerId,
      });
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException(
          "Room inventory changed while it was being updated. Please try again.",
        );
      }
      throw error;
    }
  }

  private async assertOwnedProperty(ownerId: string, propertyId: string): Promise<void> {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Property not found");
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

function hasDefinedValue(input: Record<string, unknown>): boolean {
  return Object.values(input).some((value) => value !== undefined);
}
