import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { MediaItem, MediaUploadTarget } from "../../../types";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage";
import type { AttachMediaInput, RequestUploadInput } from "./dto";

@Injectable()
export class MediaService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  /** Step 1: issue a direct-upload target for the client. */
  requestUpload(input: RequestUploadInput): Promise<MediaUploadTarget> {
    const safe = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const key = `${input.scope}/${Date.now().toString(36)}-${safe}`;
    return this.storage.createUploadTarget({ key, contentType: input.contentType });
  }

  /** Step 2a: attach an uploaded asset to a property. */
  async attachPropertyMedia(
    ownerId: string,
    propertyId: string,
    input: AttachMediaInput,
  ): Promise<MediaItem> {
    await this.assertOwnedProperty(ownerId, propertyId);
    const m = await prisma.propertyMedia.create({
      data: {
        propertyId,
        url: input.publicUrl,
        altText: input.altText ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return { id: m.id, url: m.url, altText: m.altText, sortOrder: m.sortOrder };
  }

  /** Step 2b: attach an uploaded asset to a room type. */
  async attachRoomMedia(
    ownerId: string,
    roomTypeId: string,
    input: AttachMediaInput,
  ): Promise<MediaItem> {
    await this.assertOwnedRoomType(ownerId, roomTypeId);
    const m = await prisma.roomMedia.create({
      data: {
        roomTypeId,
        url: input.publicUrl,
        altText: input.altText ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return { id: m.id, url: m.url, altText: m.altText, sortOrder: m.sortOrder };
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
