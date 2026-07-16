import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "../../../db";
import type { AuthUser, PropertyDetail, PropertySummary } from "../../../types";
import type { CreatePropertyInput, UpdatePropertyInput } from "./dto";
import { PropertyReviewService } from "../property-review/property-review.service";
import { AuditService } from "../audit/audit.service";
import { auditActorId } from "../auth/auth.service";
import {
  propertyDetailInclude,
  propertySummaryInclude,
  toPropertyDetail,
  toPropertySummary,
} from "./mappers";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Owner-facing property authoring. The backend owns every state transition;
 * `ownerId` is the authenticated principal.
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyReview: PropertyReviewService,
    private readonly audit: AuditService,
  ) {}

  async createDraft(
    ownerId: string,
    input: CreatePropertyInput,
  ): Promise<PropertyDetail> {
    await this.assertCityExists(input.cityId);
    const slug = `${slugify(input.name) || "property"}-${Date.now().toString(36)}`;
    const created = await prisma.property.create({
      data: {
        ownerId,
        cityId: input.cityId,
        name: input.name,
        slug,
        description: input.description ?? null,
        status: "DRAFT",
      },
    });
    return this.getById(created.id);
  }

  async update(
    ownerId: string,
    id: string,
    input: UpdatePropertyInput,
  ): Promise<PropertyDetail> {
    await this.assertOwned(ownerId, id);
    if (!hasDefinedValue(input)) return this.getById(id);
    if (input.cityId) await this.assertCityExists(input.cityId);
    await prisma.property.update({
      where: { id },
      data: {
        name: input.name,
        cityId: input.cityId,
        description: input.description,
      },
    });
    await this.propertyReview.recordContentChange(id, { actorUserId: ownerId });
    return this.getById(id);
  }

  /** Owner submits a draft for automatic review, with admin fallback. */
  async submitForReview(ownerId: string, id: string): Promise<PropertyDetail> {
    const property = await this.assertOwned(ownerId, id);
    if (property.status === "APPROVED") {
      throw new BadRequestException("This property is already live.");
    }
    if (property.status === "ARCHIVED") {
      throw new BadRequestException("Archived properties cannot be submitted.");
    }
    await prisma.property.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        reviewStatus: "PENDING",
        reviewSource: "AUTO_REVIEW",
        reviewedAt: null,
        scheduledPublishAt: null,
      },
    });
    await this.propertyReview.reviewSubmittedProperty(id);
    return this.getById(id);
  }

  async listForOwner(ownerId: string): Promise<PropertySummary[]> {
    const rows = await prisma.property.findMany({
      where: { ownerId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      include: propertySummaryInclude,
    });
    return rows.map(toPropertySummary);
  }

  async getForOwner(ownerId: string, id: string): Promise<PropertyDetail> {
    await this.assertOwned(ownerId, id);
    return this.getById(id);
  }

  async archiveOwned(
    ownerId: string,
    id: string,
  ): Promise<{ id: string; status: "ARCHIVED" }> {
    await this.assertOwned(ownerId, id);
    return this.archive(id, ownerId, "PROPERTY_ARCHIVED_BY_OWNER");
  }

  async archiveForAdmin(
    admin: AuthUser,
    id: string,
  ): Promise<{ id: string; status: "ARCHIVED" }> {
    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Property not found");
    return this.archive(id, auditActorId(admin), "PROPERTY_ARCHIVED_BY_ADMIN");
  }

  async getById(id: string): Promise<PropertyDetail> {
    const property = await prisma.property.findUnique({
      where: { id },
      include: propertyDetailInclude,
    });
    if (!property) throw new NotFoundException("Property not found");
    return toPropertyDetail(property);
  }

  /**
   * Guard the `cityId` foreign key before writing. Without this, an unknown city
   * id (e.g. a stale client value) reaches Prisma as a constraint violation and
   * surfaces as an opaque 500; here it becomes an honest, actionable 400.
   */
  private async assertCityExists(cityId: string): Promise<void> {
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true },
    });
    if (!city)
      throw new BadRequestException(
        "Unknown city. Please pick a city from the list.",
      );
  }

  private async archive(
    id: string,
    actorUserId: string,
    action: string,
  ): Promise<{ id: string; status: "ARCHIVED" }> {
    const now = new Date();
    const [activeBookings, activeHolds] = await Promise.all([
      prisma.booking.count({
        where: {
          roomUnit: { roomType: { propertyId: id } },
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          checkOut: { gt: now },
        },
      }),
      prisma.bookingHold.count({
        where: {
          roomUnit: { roomType: { propertyId: id } },
          expiresAt: { gt: now },
        },
      }),
    ]);
    if (activeBookings > 0 || activeHolds > 0) {
      const bookingCopy = `${activeBookings} active or upcoming booking${activeBookings === 1 ? "" : "s"}`;
      const holdCopy = `${activeHolds} live checkout hold${activeHolds === 1 ? "" : "s"}`;
      throw new ConflictException(
        `This property cannot be deleted while it has ${bookingCopy} and ${holdCopy}. Resolve or complete those records first.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyReviewRun.updateMany({
        where: { propertyId: id, status: { in: ["PENDING", "SCHEDULED"] } },
        data: {
          status: "CANCELLED",
          completedAt: now,
          summary: "Cancelled because the property was archived.",
        },
      });
      await tx.property.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          reviewStatus: "CANCELLED",
          scheduledPublishAt: null,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          action,
          entityType: "Property",
          entityId: id,
          propertyId: id,
        },
        tx,
      );
    });
    return { id, status: "ARCHIVED" };
  }

  private async assertOwned(
    ownerId: string,
    id: string,
  ): Promise<{
    id: string;
    status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  }> {
    const found = await prisma.property.findFirst({
      where: { id, ownerId },
      select: { id: true, status: true },
    });
    if (!found) throw new NotFoundException("Property not found");
    return found;
  }
}

function hasDefinedValue(input: Record<string, unknown>): boolean {
  return Object.values(input).some((value) => value !== undefined);
}
