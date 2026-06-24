import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type {
  CreateRoomTypeInput,
  CreateRoomUnitInput,
  UpdateRoomTypeInput,
} from "./dto";

/** Owner room-type and room-unit setup for a property. */
@Injectable()
export class RoomsService {
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
    return prisma.roomType.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        description: input.description ?? null,
        basePriceKobo: input.basePriceKobo,
        maxGuests: input.maxGuests,
      },
    });
  }

  async updateRoomType(ownerId: string, id: string, input: UpdateRoomTypeInput) {
    await this.assertOwnedRoomType(ownerId, id);
    return prisma.roomType.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        basePriceKobo: input.basePriceKobo,
        maxGuests: input.maxGuests,
      },
    });
  }

  async listRoomUnits(ownerId: string, roomTypeId: string) {
    await this.assertOwnedRoomType(ownerId, roomTypeId);
    return prisma.roomUnit.findMany({
      where: { roomTypeId },
      orderBy: { createdAt: "asc" },
    });
  }

  async addRoomUnit(ownerId: string, input: CreateRoomUnitInput) {
    await this.assertOwnedRoomType(ownerId, input.roomTypeId);
    return prisma.roomUnit.create({
      data: { roomTypeId: input.roomTypeId, code: input.code ?? null },
    });
  }

  private async assertOwnedProperty(ownerId: string, propertyId: string): Promise<void> {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Property not found");
  }

  private async assertOwnedRoomType(ownerId: string, roomTypeId: string): Promise<void> {
    const roomType = await prisma.roomType.findFirst({
      where: { id: roomTypeId, property: { ownerId } },
      select: { id: true },
    });
    if (!roomType) throw new NotFoundException("Room type not found");
  }
}
