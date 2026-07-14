import { Injectable, NotFoundException } from "@nestjs/common";
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
      include: { _count: { select: { roomUnits: true } } },
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
      where: { roomTypeId },
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
