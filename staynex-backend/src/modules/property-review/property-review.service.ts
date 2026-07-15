import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../db";
import { addUtcDays, utcToday } from "../../common/dates";
import { readNonNegativeIntEnv } from "../../common/env";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  evaluatePropertyReview,
  hasBannedListingContent,
  type PropertyReviewFacts,
  type PropertyReviewPolicyResult,
} from "./property-review-policy";

const AUTO_PUBLISH_DELAY_MS = readNonNegativeIntEnv(
  "PROPERTY_AUTO_PUBLISH_DELAY_MS",
  2 * 60_000,
);
const REVIEW_WINDOW_DAYS = 30;

type ReviewableStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface ContentChangeOptions {
  actorUserId?: string;
  rerunIfPending?: boolean;
  unpublishApproved?: boolean;
}

interface ReviewFactsSnapshot extends PropertyReviewFacts {
  propertyId: string;
  ownerId: string;
  contentVersion: number;
}

@Injectable()
export class PropertyReviewService {
  private readonly logger = new Logger(PropertyReviewService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async reviewSubmittedProperty(propertyId: string): Promise<void> {
    const facts = await this.loadFacts(propertyId);
    if (!facts) throw new NotFoundException("Property not found");

    const result = evaluatePropertyReview(facts);
    const now = new Date();
    const scheduledAt = result.passed ? new Date(now.getTime() + AUTO_PUBLISH_DELAY_MS) : null;
    const reviewStatus = result.passed ? "SCHEDULED" : "FAILED";

    await prisma.$transaction(async (tx) => {
      await tx.propertyReviewRun.updateMany({
        where: { propertyId, status: { in: ["PENDING", "SCHEDULED"] } },
        data: {
          status: "CANCELLED",
          completedAt: now,
          summary: "Superseded by a newer auto-review.",
        },
      });

      const run = await tx.propertyReviewRun.create({
        data: {
          propertyId,
          contentVersion: facts.contentVersion,
          source: "AUTO_REVIEW",
          status: reviewStatus,
          riskScore: result.riskScore,
          summary: result.summary,
          scheduledPublishAt: scheduledAt,
          completedAt: now,
          checks: {
            create: result.checks.map((check) => ({
              key: check.key,
              label: check.label,
              status: check.status,
              severity: check.severity,
              details: check.details,
            })),
          },
        },
        select: { id: true },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          status: "PENDING_REVIEW",
          reviewStatus,
          reviewSource: "AUTO_REVIEW",
          reviewedAt: now,
          scheduledPublishAt: scheduledAt,
        },
      });

      await this.audit.record(
        {
          actorUserId: null,
          action: result.passed ? "PROPERTY_AUTO_REVIEW_PASSED" : "PROPERTY_AUTO_REVIEW_FAILED",
          entityType: "PropertyReviewRun",
          entityId: run.id,
          propertyId,
        },
        tx,
      );
    });

    await this.notifyReviewResult(facts.ownerId, propertyId, result, scheduledAt);
  }

  async recordContentChange(
    propertyId: string,
    options: ContentChangeOptions = {},
  ): Promise<void> {
    const rerunIfPending = options.rerunIfPending ?? true;
    const unpublishApproved = options.unpublishApproved ?? true;
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, status: true, contentVersion: true },
    });
    if (!property || property.status === "ARCHIVED") return;

    const nextStatus = this.statusAfterContentChange(property.status, unpublishApproved);
    const shouldRerun = nextStatus === "PENDING_REVIEW" && rerunIfPending;
    const shouldPreserveReview = property.status === "APPROVED" && nextStatus === "APPROVED";
    const reviewStatus = shouldRerun ? "PENDING" : "NOT_SUBMITTED";

    await prisma.$transaction(async (tx) => {
      await tx.propertyReviewRun.updateMany({
        where: { propertyId, status: { in: ["PENDING", "SCHEDULED"] } },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          summary: "Cancelled because owner-controlled listing content changed.",
        },
      });
      await tx.property.update({
        where: { id: propertyId },
        data: {
          contentVersion: { increment: 1 },
          status: nextStatus,
          ...(shouldPreserveReview
            ? {}
            : {
                reviewStatus,
                reviewSource: shouldRerun ? "AUTO_REVIEW" : null,
                reviewedAt: null,
                scheduledPublishAt: null,
              }),
        },
      });
      if (property.status === "APPROVED" && nextStatus !== "APPROVED") {
        await this.audit.record(
          {
            actorUserId: options.actorUserId ?? null,
            action: "PROPERTY_UNPUBLISHED_FOR_OWNER_CHANGES",
            entityType: "Property",
            entityId: propertyId,
            propertyId,
          },
          tx,
        );
      }
    });

    if (shouldRerun) await this.reviewSubmittedProperty(propertyId);
  }

  async publishDueProperties(): Promise<{ published: number; cancelled: number }> {
    const now = new Date();
    const dueRuns = await prisma.propertyReviewRun.findMany({
      where: {
        status: "SCHEDULED",
        scheduledPublishAt: { not: null, lte: now },
      },
      orderBy: { scheduledPublishAt: "asc" },
      take: 25,
      select: {
        id: true,
        propertyId: true,
        contentVersion: true,
      },
    });

    let published = 0;
    let cancelled = 0;
    for (const run of dueRuns) {
      const outcome = await this.publishRunIfCurrent(run.id, run.propertyId, run.contentVersion);
      if (outcome === "published") {
        published += 1;
        await this.notifications.onPropertyPublished(run.propertyId);
      } else {
        cancelled += 1;
      }
    }
    return { published, cancelled };
  }

  private async publishRunIfCurrent(
    runId: string,
    propertyId: string,
    contentVersion: number,
  ): Promise<"published" | "cancelled"> {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.property.updateMany({
        where: {
          id: propertyId,
          status: "PENDING_REVIEW",
          reviewStatus: "SCHEDULED",
          contentVersion,
        },
        data: {
          status: "APPROVED",
          reviewStatus: "PUBLISHED",
          reviewSource: "AUTO_REVIEW",
          reviewedAt: now,
          scheduledPublishAt: null,
        },
      });

      if (updated.count !== 1) {
        await tx.propertyReviewRun.update({
          where: { id: runId },
          data: {
            status: "CANCELLED",
            completedAt: now,
            summary: "Cancelled because the reviewed content version is no longer current.",
          },
        });
        return "cancelled";
      }

      await tx.propertyReviewRun.update({
        where: { id: runId },
        data: { status: "PUBLISHED", publishedAt: now, completedAt: now },
      });
      await this.audit.record(
        {
          actorUserId: null,
          action: "PROPERTY_AUTO_PUBLISHED",
          entityType: "PropertyReviewRun",
          entityId: runId,
          propertyId,
        },
        tx,
      );
      return "published";
    });
  }

  private async loadFacts(propertyId: string): Promise<ReviewFactsSnapshot | null> {
    const start = utcToday();
    const end = addUtcDays(start, REVIEW_WINDOW_DAYS);
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        ownerId: true,
        cityId: true,
        name: true,
        description: true,
        contentVersion: true,
        owner: {
          select: {
            email: true,
            role: true,
            capabilities: { select: { capability: true } },
            payoutMethod: { select: { status: true } },
          },
        },
        city: { select: { id: true } },
        media: { where: { mediaType: "IMAGE" }, select: { id: true } },
        roomTypes: {
          select: {
            name: true,
            description: true,
            basePriceKobo: true,
            roomUnits: { select: { isActive: true } },
            availability: {
              where: { date: { gte: start, lt: end } },
              select: { date: true, totalUnits: true, bookedUnits: true, heldUnits: true },
            },
          },
        },
      },
    });
    if (!property) return null;

    const duplicateCandidateCount = await prisma.property.count({
      where: {
        id: { not: propertyId },
        ownerId: property.ownerId,
        cityId: property.cityId,
        status: { not: "ARCHIVED" },
        name: { equals: property.name, mode: "insensitive" },
      },
    });

    const listingCopy = [
      property.name,
      property.description ?? "",
      ...property.roomTypes.flatMap((room) => [room.name, room.description ?? ""]),
    ].join("\n");

    return {
      propertyId,
      ownerId: property.ownerId,
      contentVersion: property.contentVersion,
      hasOwnerEmail: Boolean(property.owner.email),
      hasOwnerCapability:
        property.owner.role === "OWNER" ||
        property.owner.capabilities.some((grant) => grant.capability === "OWNER"),
      hasActivePayoutMethod: property.owner.payoutMethod?.status === "ACTIVE",
      name: property.name,
      description: property.description,
      hasCity: Boolean(property.city),
      propertyImageCount: property.media.length,
      roomTypeCount: property.roomTypes.length,
      pricedRoomTypeCount: property.roomTypes.filter((room) => room.basePriceKobo > 0).length,
      activeUnitCount: property.roomTypes.reduce(
        (sum, room) => sum + room.roomUnits.filter((unit) => unit.isActive).length,
        0,
      ),
      availableFutureDays: countAvailableDays(property.roomTypes),
      duplicateCandidateCount,
      hasBannedContent: hasBannedListingContent(listingCopy),
    };
  }

  private statusAfterContentChange(
    currentStatus: ReviewableStatus,
    unpublishApproved: boolean,
  ): ReviewableStatus {
    if (currentStatus === "PENDING_REVIEW") return "PENDING_REVIEW";
    if (currentStatus === "APPROVED" && !unpublishApproved) return "APPROVED";
    if (currentStatus === "APPROVED") return "DRAFT";
    if (currentStatus === "ARCHIVED") return "ARCHIVED";
    return "DRAFT";
  }

  private async notifyReviewResult(
    ownerId: string,
    propertyId: string,
    result: PropertyReviewPolicyResult,
    scheduledAt: Date | null,
  ): Promise<void> {
    try {
      if (result.passed && scheduledAt) {
        await this.notifications.onPropertyAutoReviewScheduled(propertyId, scheduledAt);
        return;
      }
      const failedLabels = result.checks
        .filter((check) => check.status === "FAIL")
        .map((check) => check.label);
      await this.notifications.onPropertyReviewNeedsChanges(propertyId, failedLabels);
    } catch (err) {
      this.logger.error(
        `Review notification failed for owner ${ownerId}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    }
  }
}

function countAvailableDays(
  roomTypes: Array<{
    availability: Array<{ date: Date; totalUnits: number; bookedUnits: number; heldUnits: number }>;
  }>,
): number {
  const dates = new Set<string>();
  for (const room of roomTypes) {
    for (const day of room.availability) {
      if (day.totalUnits - day.bookedUnits - day.heldUnits > 0) {
        dates.add(day.date.toISOString().slice(0, 10));
      }
    }
  }
  return dates.size;
}
