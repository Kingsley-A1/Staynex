import { Prisma } from "@prisma/client";
import type {
  MediaItem,
  PropertyDetail,
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

export const propertySummaryInclude = Prisma.validator<Prisma.PropertyInclude>()({
  city: { select: { name: true } },
  media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  roomTypes: { select: { basePriceKobo: true } },
});
export type PropertySummaryRow = Prisma.PropertyGetPayload<{
  include: typeof propertySummaryInclude;
}>;

export const propertyDetailInclude = Prisma.validator<Prisma.PropertyInclude>()({
  city: { select: { name: true } },
  media: { orderBy: { sortOrder: "asc" } },
  roomTypes: {
    orderBy: { createdAt: "asc" },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      _count: { select: { roomUnits: true } },
    },
  },
  reviewRuns: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { checks: { orderBy: { createdAt: "asc" } } },
  },
});
export type PropertyDetailRow = Prisma.PropertyGetPayload<{
  include: typeof propertyDetailInclude;
}>;

function toMedia(m: {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}): MediaItem {
  return { id: m.id, url: m.url, altText: m.altText, sortOrder: m.sortOrder };
}

export function toPropertySummary(p: PropertySummaryRow): PropertySummary {
  const prices = p.roomTypes.map((r) => r.basePriceKobo);
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
    description: p.description,
    fromPriceKobo: prices.length ? Math.min(...prices) : null,
    roomTypeCount: roomTypes.length,
    coverImageUrl: p.media[0]?.url ?? null,
    updatedAt: p.updatedAt.toISOString(),
    media: p.media.map(toMedia),
    roomTypes,
    latestReview: toReviewRun(p.reviewRuns[0] ?? null),
  };
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
      key: check.key,
      label: check.label,
      status: check.status as PropertyReviewCheckStatus,
      severity: check.severity,
      details: check.details,
    })),
  };
}
