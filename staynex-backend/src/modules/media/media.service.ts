import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import type { MediaItem, MediaUploadTarget } from "../../../types";
import { MIN_PROPERTY_IMAGES } from "../property-review/property-review-policy";
import { PropertyReviewService } from "../property-review/property-review.service";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage";
import {
  MEDIA_CONTENT_TYPES,
  maxBytesForContentType,
  mediaKindForContentType,
  type AttachMediaInput,
  type RequestUploadInput,
} from "./dto";

/**
 * Host media authoring. Uploads go directly to storage via a presigned target;
 * attach/detach/reorder run here, and every attached object is verified against
 * storage (exists, allowed media type, within size) before a row is written.
 *
 * Media changes never unpublish an APPROVED listing: images only feed the
 * `media_ready` count check, so the review pipeline re-runs without pulling a
 * live property off the market. The one guard in the other direction: a live
 * listing may not drop below the review photo minimum via deletion.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly propertyReview: PropertyReviewService,
  ) {}

  /** Step 1: issue a direct-upload target for the client. */
  requestUpload(input: RequestUploadInput): Promise<MediaUploadTarget> {
    const safe = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[._-]+/, "");
    const key = `${input.scope}/${Date.now().toString(36)}-${safe || "media"}`;
    return this.storage.createUploadTarget({ key, contentType: input.contentType });
  }

  /** Step 2a: verify the uploaded object and attach it to a property. */
  async attachPropertyMedia(
    ownerId: string,
    propertyId: string,
    input: AttachMediaInput,
  ): Promise<MediaItem> {
    await this.assertOwnedProperty(ownerId, propertyId);
    const verified = await this.verifyUploadedObject(input.key, "property");

    const media = await prisma.$transaction(async (tx) => {
      const existing = await tx.propertyMedia.findFirst({
        where: { propertyId, url: verified.url },
        select: { id: true, url: true, mediaType: true, altText: true, sortOrder: true },
      });
      if (existing) return existing; // idempotent re-attach (double submit)

      const last = await tx.propertyMedia.aggregate({
        where: { propertyId },
        _max: { sortOrder: true },
      });
      return tx.propertyMedia.create({
        data: {
          propertyId,
          url: verified.url,
          mediaType: verified.mediaType,
          altText: input.altText?.trim() || null,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
    });

    await this.propertyReview.recordContentChange(propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    return toMediaItem(media);
  }

  /** Step 2b: verify the uploaded object and attach it to a room type. */
  async attachRoomMedia(
    ownerId: string,
    roomTypeId: string,
    input: AttachMediaInput,
  ): Promise<MediaItem> {
    const roomType = await this.assertOwnedRoomType(ownerId, roomTypeId);
    const verified = await this.verifyUploadedObject(input.key, "room");

    const media = await prisma.$transaction(async (tx) => {
      const existing = await tx.roomMedia.findFirst({
        where: { roomTypeId, url: verified.url },
        select: { id: true, url: true, mediaType: true, altText: true, sortOrder: true },
      });
      if (existing) return existing;

      const last = await tx.roomMedia.aggregate({
        where: { roomTypeId },
        _max: { sortOrder: true },
      });
      return tx.roomMedia.create({
        data: {
          roomTypeId,
          url: verified.url,
          mediaType: verified.mediaType,
          altText: input.altText?.trim() || null,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
    });

    await this.propertyReview.recordContentChange(roomType.propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    return toMediaItem(media);
  }

  async deletePropertyMedia(ownerId: string, mediaId: string): Promise<{ ok: true }> {
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, property: { ownerId } },
      select: {
        id: true,
        url: true,
        mediaType: true,
        propertyId: true,
        property: { select: { status: true } },
      },
    });
    if (!media) throw new NotFoundException("Media not found");

    if (media.property.status === "APPROVED" && media.mediaType === "IMAGE") {
      const count = await prisma.propertyMedia.count({
        where: { propertyId: media.propertyId, mediaType: "IMAGE" },
      });
      if (count <= MIN_PROPERTY_IMAGES) {
        throw new BadRequestException(
          `Live listings must keep at least ${MIN_PROPERTY_IMAGES} photos. Add a replacement first.`,
        );
      }
    }

    await prisma.propertyMedia.delete({ where: { id: media.id } });
    await this.propertyReview.recordContentChange(media.propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    await this.deleteStoredObject(media.url);
    return { ok: true };
  }

  async deleteRoomMedia(ownerId: string, mediaId: string): Promise<{ ok: true }> {
    const media = await prisma.roomMedia.findFirst({
      where: { id: mediaId, roomType: { property: { ownerId } } },
      select: { id: true, url: true, roomType: { select: { propertyId: true } } },
    });
    if (!media) throw new NotFoundException("Media not found");

    await prisma.roomMedia.delete({ where: { id: media.id } });
    await this.propertyReview.recordContentChange(media.roomType.propertyId, {
      actorUserId: ownerId,
      unpublishApproved: false,
    });
    await this.deleteStoredObject(media.url);
    return { ok: true };
  }

  async updatePropertyMediaAlt(
    ownerId: string,
    mediaId: string,
    altText: string | null,
  ): Promise<MediaItem> {
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, property: { ownerId } },
      select: { id: true },
    });
    if (!media) throw new NotFoundException("Media not found");
    const updated = await prisma.propertyMedia.update({
      where: { id: media.id },
      data: { altText: altText?.trim() || null },
    });
    return toMediaItem(updated);
  }

  async updateRoomMediaAlt(
    ownerId: string,
    mediaId: string,
    altText: string | null,
  ): Promise<MediaItem> {
    const media = await prisma.roomMedia.findFirst({
      where: { id: mediaId, roomType: { property: { ownerId } } },
      select: { id: true },
    });
    if (!media) throw new NotFoundException("Media not found");
    const updated = await prisma.roomMedia.update({
      where: { id: media.id },
      data: { altText: altText?.trim() || null },
    });
    return toMediaItem(updated);
  }

  /**
   * Replace a property gallery's order. `mediaIds` must be exactly the gallery's
   * current ids — first becomes the cover. Order is presentation-only, so no
   * review re-run.
   */
  async reorderPropertyMedia(
    ownerId: string,
    propertyId: string,
    mediaIds: string[],
  ): Promise<MediaItem[]> {
    await this.assertOwnedProperty(ownerId, propertyId);
    const rows = await prisma.propertyMedia.findMany({
      where: { propertyId },
      select: { id: true },
    });
    assertExactIdSet(rows.map((r) => r.id), mediaIds);

    await prisma.$transaction(
      mediaIds.map((id, index) =>
        prisma.propertyMedia.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    const updated = await prisma.propertyMedia.findMany({
      where: { propertyId },
      orderBy: { sortOrder: "asc" },
    });
    return updated.map(toMediaItem);
  }

  /** Room-gallery variant of {@link reorderPropertyMedia}. */
  async reorderRoomMedia(
    ownerId: string,
    roomTypeId: string,
    mediaIds: string[],
  ): Promise<MediaItem[]> {
    await this.assertOwnedRoomType(ownerId, roomTypeId);
    const rows = await prisma.roomMedia.findMany({
      where: { roomTypeId },
      select: { id: true },
    });
    assertExactIdSet(rows.map((r) => r.id), mediaIds);

    await prisma.$transaction(
      mediaIds.map((id, index) =>
        prisma.roomMedia.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    const updated = await prisma.roomMedia.findMany({
      where: { roomTypeId },
      orderBy: { sortOrder: "asc" },
    });
    return updated.map(toMediaItem);
  }

  // --- internals -----------------------------------------------------------

  /**
   * The trust boundary of the upload flow: the client hands us a key, and we
   * confirm with storage that the object exists, is an allowed media type, and
   * is within the size ceiling — then derive the public URL ourselves.
   */
  private async verifyUploadedObject(
    key: string,
    scope: "property" | "room",
  ): Promise<{ url: string; mediaType: "IMAGE" | "VIDEO" }> {
    if (!key.startsWith(`${scope}/`)) {
      throw new BadRequestException("This upload belongs to a different media scope.");
    }
    const info = await this.storage.headObject(key);
    if (!info) {
      throw new BadRequestException(
        "Uploaded file not found in storage. Upload the media first, then attach it.",
      );
    }
    const mediaType = mediaKindForContentType(info.contentType);
    if (
      !info.contentType ||
      !mediaType ||
      !(MEDIA_CONTENT_TYPES as readonly string[]).includes(info.contentType)
    ) {
      await this.storage.deleteObject(key).catch(() => {});
      throw new BadRequestException(
        "Only JPEG, PNG, WebP, AVIF, MP4, MOV, or WebM media can be attached.",
      );
    }
    const maxBytes = maxBytesForContentType(info.contentType);
    if (info.sizeBytes <= 0 || info.sizeBytes > maxBytes) {
      await this.storage.deleteObject(key).catch(() => {});
      throw new BadRequestException(
        `${
          mediaType === "VIDEO" ? "Videos" : "Images"
        } must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      );
    }
    return { url: this.storage.publicUrl(key), mediaType };
  }

  /**
   * Best-effort storage cleanup after a row delete. Never fails the request —
   * a leaked object is recovered by the orphan sweeper; a failed API call to
   * the owner is not recoverable UX. Legacy rows with URLs outside our storage
   * base have no key and are skipped.
   */
  private async deleteStoredObject(url: string): Promise<void> {
    const key = this.storage.keyForUrl(url);
    if (!key) return;
    try {
      await this.storage.deleteObject(key);
    } catch (err) {
      this.logger.warn(
        `Storage delete failed for ${key} (sweeper will retry): ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
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

function toMediaItem(m: {
  id: string;
  url: string;
  mediaType: "IMAGE" | "VIDEO";
  altText: string | null;
  sortOrder: number;
}): MediaItem {
  return {
    id: m.id,
    url: m.url,
    mediaType: m.mediaType,
    altText: m.altText,
    sortOrder: m.sortOrder,
  };
}

/** Reorder payloads must be a permutation of the gallery — no more, no less. */
function assertExactIdSet(current: string[], proposed: string[]): void {
  const currentSet = new Set(current);
  const proposedSet = new Set(proposed);
  const identical =
    currentSet.size === proposedSet.size &&
    proposed.length === proposedSet.size &&
    [...currentSet].every((id) => proposedSet.has(id));
  if (!identical) {
    throw new BadRequestException(
      "Photo order is out of date — refresh the gallery and try again.",
    );
  }
}
