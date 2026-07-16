import { Prisma } from "@prisma/client";
import type {
  MediaItem,
  PropertyDetail,
  PropertyReviewCheckKey,
  PropertyReviewCheckStatus,
  PropertyReviewRunView,
  PropertyReviewSource,
  PropertyReviewStatus,
  PropertyStatus,
  PropertySummary,
  RoomTypeDetail,
} from "../../../types";

// Shared query shapes + Prisma -> contract mappers. Centralized so the owner and
// admin surfaces return identical property shapes (no duplicated mapping logic).

export const propertySummaryInclude =
  Prisma.validator<Prisma.PropertyInclude>()({
    city: { select: { name: true } },
    media: {
      where: { mediaType: "IMAGE" },
      orderBy: { sortOrder: "asc" },
      take: 1,
      select: { url: true },
    },
    roomTypes: {
      select: {
        basePriceKobo: true,
        availability: {
          where: { totalUnits: { gt: 0 } },
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
    },
  });
export type PropertySummaryRow = Prisma.PropertyGetPayload<{
  include: typeof propertySummaryInclude;
}>;

export const propertyDetailInclude = Prisma.validator<Prisma.PropertyInclude>()(
  {
    city: { select: { id: true, name: true } },
    area: { select: { id: true, name: true } },
    media: { orderBy: { sortOrder: "asc" } },
    roomTypes: {
      orderBy: { createdAt: "asc" },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
        availability: {
          where: { totalUnits: { gt: 0 } },
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
        _count: {
          select: { roomUnits: { where: { isActive: true } } },
        },
      },
    },
    reviewRuns: {
      orderBy: { createdAt: "desc" },
      take: 1,
      include: { checks: { orderBy: { createdAt: "asc" } } },
    },
  },
);
export type PropertyDetailRow = Prisma.PropertyGetPayload<{
  include: typeof propertyDetailInclude;
}>;

function toMedia(m: {
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

export function toPropertySummary(p: PropertySummaryRow): PropertySummary {
  const prices = p.roomTypes.map((r) => r.basePriceKobo);
  const availabilityEndsAt = latestAvailabilityDate(p.roomTypes);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status as PropertyStatus,
    reviewStatus: p.reviewStatus as PropertyReviewStatus,
    reviewSource: p.reviewSource as PropertyReviewSource | null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    scheduledPublishAt: p.scheduledPublishAt?.toISOString() ?? null,
    cityName: p.city.name,
    fromPriceKobo: prices.length ? Math.min(...prices) : null,
    roomTypeCount: p.roomTypes.length,
    coverImageUrl: p.media[0]?.url ?? null,
    availabilityEndsAt,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPropertyDetail(p: PropertyDetailRow): PropertyDetail {
  const roomTypes: RoomTypeDetail[] = p.roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    description: rt.description,
    basePriceKobo: rt.basePriceKobo,
    maxGuests: rt.maxGuests,
    unitCount: rt._count.roomUnits,
    media: rt.media.map(toMedia),
  }));
  const prices = roomTypes.map((r) => r.basePriceKobo);
  const availabilityEndsAt = latestAvailabilityDate(p.roomTypes);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status as PropertyStatus,
    reviewStatus: p.reviewStatus as PropertyReviewStatus,
    reviewSource: p.reviewSource as PropertyReviewSource | null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    scheduledPublishAt: p.scheduledPublishAt?.toISOString() ?? null,
    cityName: p.city.name,
    cityId: p.city.id,
    areaId: p.area?.id ?? null,
    areaName: p.area?.name ?? null,
    description: p.description,
    fromPriceKobo: prices.length ? Math.min(...prices) : null,
    roomTypeCount: roomTypes.length,
    coverImageUrl: p.media.find((m) => m.mediaType === "IMAGE")?.url ?? null,
    availabilityEndsAt,
    updatedAt: p.updatedAt.toISOString(),
    media: p.media.map(toMedia),
    roomTypes,
    latestReview: toReviewRun(p.reviewRuns[0] ?? null),
  };
}

function latestAvailabilityDate(
  roomTypes: Array<{ availability: Array<{ date: Date }> }>,
): string | null {
  const latest = roomTypes.reduce<Date | null>((current, roomType) => {
    const date = roomType.availability[0]?.date ?? null;
    return date && (!current || date > current) ? date : current;
  }, null);
  return latest?.toISOString() ?? null;
}

function toReviewRun(
  run: PropertyDetailRow["reviewRuns"][number] | null,
): PropertyReviewRunView | null {
  if (!run) return null;
  return {
    id: run.id,
    source: run.source as PropertyReviewSource,
    status: run.status as PropertyReviewStatus,
    riskScore: run.riskScore,
    summary: run.summary,
    scheduledPublishAt: run.scheduledPublishAt?.toISOString() ?? null,
    publishedAt: run.publishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    checks: run.checks.map((check) => ({
      id: check.id,
      key: check.key as PropertyReviewCheckKey,
      label: check.label,
      status: check.status as PropertyReviewCheckStatus,
      severity: check.severity,
      details: check.details,
    })),
  };
}
