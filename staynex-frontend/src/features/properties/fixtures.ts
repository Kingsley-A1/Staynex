// Centralized Phase 2 mock data (skill.md §10: do not scatter fixtures).
// Server components render from these helpers until the live API is wired.
// Shapes match the backend contracts in @/lib/types.

import type {
  OwnerDashboardKpis,
  PropertyDetail,
  PropertyStatus,
  PropertyStatusCounts,
  PropertySummary,
} from "@/lib/types";

export interface CityOption {
  id: string;
  name: string;
}

export const CITIES: CityOption[] = [
  { id: "city_calabar", name: "Calabar" },
  { id: "city_uyo", name: "Uyo" },
  { id: "city_port-harcourt", name: "Port Harcourt" },
  { id: "city_lagos", name: "Lagos" },
  { id: "city_abuja", name: "Abuja" },
];

interface SeedRoom {
  name: string;
  priceNaira: number;
  maxGuests: number;
  units: number;
}

interface SeedProperty {
  id: string;
  name: string;
  slug: string;
  cityName: string;
  status: PropertyStatus;
  description: string;
  rooms: SeedRoom[];
}

const SEED: SeedProperty[] = [
  {
    id: "prop_marina_crest",
    name: "Marina Crest Hotel",
    slug: "marina-crest-hotel",
    cityName: "Calabar",
    status: "APPROVED",
    description:
      "Waterfront hotel with calm rooms and easy access to the marina.",
    rooms: [
      { name: "Standard Room", priceNaira: 48000, maxGuests: 2, units: 5 },
      { name: "Deluxe Room", priceNaira: 72000, maxGuests: 3, units: 3 },
    ],
  },
  {
    id: "prop_tinapa_grand",
    name: "Tinapa Grand Resort",
    slug: "tinapa-grand-resort",
    cityName: "Calabar",
    status: "PENDING_REVIEW",
    description: "Resort stays near Tinapa with family-friendly suites.",
    rooms: [
      { name: "Resort Suite", priceNaira: 72000, maxGuests: 4, units: 4 },
    ],
  },
  {
    id: "prop_harbor_nest",
    name: "Harbor Nest Apartments",
    slug: "harbor-nest-apartments",
    cityName: "Uyo",
    status: "PENDING_REVIEW",
    description: "Quiet serviced apartments ideal for longer stays.",
    rooms: [
      {
        name: "One-Bedroom Apartment",
        priceNaira: 29500,
        maxGuests: 2,
        units: 4,
      },
    ],
  },
  {
    id: "prop_duke_town",
    name: "Duke Town Suites",
    slug: "duke-town-suites",
    cityName: "Calabar",
    status: "DRAFT",
    description: "Modern self-contained suites in the heart of Calabar.",
    rooms: [
      { name: "Studio Suite", priceNaira: 36000, maxGuests: 2, units: 6 },
    ],
  },
];

function buildDetail(p: SeedProperty): PropertyDetail {
  const roomTypes = p.rooms.map((r, i) => ({
    id: `${p.id}_rt_${i}`,
    name: r.name,
    description: null,
    basePriceKobo: r.priceNaira * 100,
    maxGuests: r.maxGuests,
    unitCount: r.units,
    media: [],
  }));
  const prices = roomTypes.map((r) => r.basePriceKobo);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    reviewStatus: p.status === "APPROVED" ? "PUBLISHED" : "NOT_SUBMITTED",
    reviewSource: null,
    reviewedAt: null,
    scheduledPublishAt: null,
    cityName: p.cityName,
    fromPriceKobo: prices.length ? Math.min(...prices) : null,
    roomTypeCount: roomTypes.length,
    coverImageUrl: null,
    availabilityEndsAt: "2026-12-31T00:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    description: p.description,
    media: [],
    roomTypes,
    latestReview: null,
  };
}

const DETAILS: PropertyDetail[] = SEED.map(buildDetail);

function toSummary(d: PropertyDetail): PropertySummary {
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    status: d.status,
    reviewStatus: d.reviewStatus,
    reviewSource: d.reviewSource,
    reviewedAt: d.reviewedAt,
    scheduledPublishAt: d.scheduledPublishAt,
    cityName: d.cityName,
    fromPriceKobo: d.fromPriceKobo,
    roomTypeCount: d.roomTypeCount,
    coverImageUrl: d.coverImageUrl,
    availabilityEndsAt: d.availabilityEndsAt,
    updatedAt: d.updatedAt,
  };
}

function emptyStatusCounts(): PropertyStatusCounts {
  return { DRAFT: 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0, ARCHIVED: 0 };
}

export function listOwnerProperties(): PropertySummary[] {
  return DETAILS.map(toSummary);
}

export function getPropertyDetail(id: string): PropertyDetail | undefined {
  return DETAILS.find((d) => d.id === id);
}

export function getApprovalQueue(): PropertySummary[] {
  return DETAILS.filter((d) => d.status === "PENDING_REVIEW").map(toSummary);
}

export function getOwnerKpis(): OwnerDashboardKpis {
  const propertyStatus = DETAILS.reduce<PropertyStatusCounts>((acc, d) => {
    acc[d.status] += 1;
    return acc;
  }, emptyStatusCounts());

  const availableRooms = DETAILS.filter((d) => d.status === "APPROVED").reduce(
    (sum, d) => sum + d.roomTypes.reduce((s, r) => s + r.unitCount, 0),
    0,
  );

  return {
    totalBookings: 0,
    availableRooms,
    pendingActions: propertyStatus.DRAFT + propertyStatus.PENDING_REVIEW,
    estimatedEarningsKobo: 0,
    propertyStatus,
  };
}

// --- Public catalog fallback (used only when the live API is unreachable) ---

export function listApprovedProperties(): PropertySummary[] {
  return DETAILS.filter((d) => d.status === "APPROVED").map(toSummary);
}

export function getApprovedPropertyBySlug(
  slug: string,
): PropertyDetail | undefined {
  return DETAILS.find((d) => d.slug === slug && d.status === "APPROVED");
}
