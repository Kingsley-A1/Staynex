// Server-only catalog fetch helpers for guest browse pages. They call the live
// API; when it is unreachable they fall back to centralized fixtures (DISPLAY
// ONLY). Booking/availability/payment are never faked — those go to the backend.

import {
  getApprovedPropertyBySlug,
  listApprovedProperties,
} from "@/features/properties/fixtures";
import { API_BASE } from "@/lib/api-base";
import type {
  AreaOption,
  BookingView,
  HomeCatalogView,
  PropertyDetail,
  PropertySummary,
  PublicTestimonial,
} from "@/lib/types";

export interface SearchParams {
  city: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

const emptyHomeCatalog: HomeCatalogView = {
  latestProperties: [],
  mostBookedProperties: [],
  destinations: [],
};

const HOME_REVALIDATE_SECONDS = 300;
const BROWSE_REVALIDATE_SECONDS = 120;
const DETAIL_REVALIDATE_SECONDS = 300;

export async function getHomeCatalog(): Promise<{
  catalog: HomeCatalogView;
  live: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE}/catalog/home`, {
      next: { revalidate: HOME_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(String(res.status));
    return { catalog: (await res.json()) as HomeCatalogView, live: true };
  } catch {
    return { catalog: emptyHomeCatalog, live: false };
  }
}

export async function searchProperties(
  params: SearchParams,
): Promise<{ items: PropertySummary[]; live: boolean }> {
  const qs = new URLSearchParams({ city: params.city });
  if (params.area) qs.set("area", params.area);
  if (params.checkIn) qs.set("checkIn", params.checkIn);
  if (params.checkOut) qs.set("checkOut", params.checkOut);
  if (params.guests) qs.set("guests", String(params.guests));
  const availabilitySensitive = Boolean(
    params.checkIn || params.checkOut || params.guests,
  );
  try {
    const res = await fetch(
      `${API_BASE}/search?${qs.toString()}`,
      availabilitySensitive
        ? { cache: "no-store" }
        : { next: { revalidate: BROWSE_REVALIDATE_SECONDS } },
    );
    if (!res.ok) throw new Error(String(res.status));
    return { items: (await res.json()) as PropertySummary[], live: true };
  } catch {
    const items = listApprovedProperties().filter(
      (p) => p.cityName.toLowerCase() === params.city.toLowerCase(),
    );
    return { items, live: false };
  }
}

export async function getPublicProperty(
  slug: string,
): Promise<{ property: PropertyDetail | null; live: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/stays/${encodeURIComponent(slug)}`, {
      next: { revalidate: DETAIL_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(String(res.status));
    return { property: (await res.json()) as PropertyDetail, live: true };
  } catch {
    return { property: getApprovedPropertyBySlug(slug) ?? null, live: false };
  }
}

/** Confirmation is backend authority — no fixture fallback here. */
export async function getBookingServer(id: string): Promise<BookingView | null> {
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BookingView;
  } catch {
    return null;
  }
}

/**
 * Approved testimonials only. On failure returns [] — we never fabricate
 * reviews (skill.md / Phase 5 constraint).
 */
export async function getApprovedTestimonials(
  propertySlug?: string,
  limit?: number,
): Promise<PublicTestimonial[]> {
  const qs = new URLSearchParams();
  if (propertySlug) qs.set("propertySlug", propertySlug);
  if (limit) qs.set("limit", String(limit));
  const suffix = qs.toString();
  try {
    const res = await fetch(`${API_BASE}/reviews${suffix ? `?${suffix}` : ""}`, {
      next: { revalidate: BROWSE_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return (await res.json()) as PublicTestimonial[];
  } catch {
    return [];
  }
}

/** Areas for a city (notable first, then with-properties, then the rest). */
export async function getAreasForCity(city: string): Promise<AreaOption[]> {
  try {
    const res = await fetch(`${API_BASE}/areas?city=${encodeURIComponent(city)}`, {
      next: { revalidate: BROWSE_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return (await res.json()) as AreaOption[];
  } catch {
    return [];
  }
}
