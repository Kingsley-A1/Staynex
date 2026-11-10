// Server-only catalog fetch helpers for guest browse pages. Production catalog,
// availability, and payment state are API-backed and never replaced by fixtures.

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api-base";
import type {
  AreaOption,
  BookingView,
  CityOption,
  HomeCatalogView,
  PropertyDetail,
  PropertySummary,
  PublicTestimonial,
  VoucherVerification,
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

async function authHeaders(): Promise<HeadersInit | undefined> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return undefined;
  return { cookie: all.map((item) => `${item.name}=${item.value}`).join("; ") };
}

export type CatalogListResult<T> =
  | { status: "data"; data: T[] }
  | { status: "empty"; data: [] }
  | { status: "unavailable"; data: null; reason: string };

export type CatalogDetailResult<T> =
  | { status: "data"; data: T }
  | { status: "not_found"; data: null }
  | { status: "unavailable"; data: null; reason: string };

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
): Promise<CatalogListResult<PropertySummary>> {
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
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The stay search service returned status ${res.status}.`,
      };
    }
    const items = (await res.json()) as PropertySummary[];
    return items.length > 0
      ? { status: "data", data: items }
      : { status: "empty", data: [] };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach the live stay search service.",
    };
  }
}

export async function getCatalogCities(): Promise<
  CatalogListResult<CityOption>
> {
  try {
    const res = await fetch(`${API_BASE}/catalog/cities`, {
      next: { revalidate: BROWSE_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The destination service returned status ${res.status}.`,
      };
    }
    const cities = (await res.json()) as CityOption[];
    return cities.length > 0
      ? { status: "data", data: cities }
      : { status: "empty", data: [] };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach the live destination service.",
    };
  }
}

export async function getPublicProperty(
  slug: string,
): Promise<CatalogDetailResult<PropertyDetail>> {
  try {
    const res = await fetch(`${API_BASE}/stays/${encodeURIComponent(slug)}`, {
      next: { revalidate: DETAIL_REVALIDATE_SECONDS },
    });
    if (res.status === 404) return { status: "not_found", data: null };
    if (!res.ok) {
      return {
        status: "unavailable",
        data: null,
        reason: `The property service returned status ${res.status}.`,
      };
    }
    return {
      status: "data",
      data: (await res.json()) as PropertyDetail,
    };
  } catch {
    return {
      status: "unavailable",
      data: null,
      reason: "Staynex could not reach the live property service.",
    };
  }
}

/** Confirmation is backend authority — no fixture fallback here. */
export async function getBookingServer(
  id: string,
): Promise<BookingView | null> {
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as BookingView;
  } catch {
    return null;
  }
}

/**
 * Public booking verification (the QR target). Backend authority — a null
 * result means unreachable, distinct from a NOT_FOUND card the API returns.
 */
export async function getVoucherVerification(
  reference: string,
): Promise<VoucherVerification | null> {
  try {
    const res = await fetch(
      `${API_BASE}/verify/${encodeURIComponent(reference)}`,
      {
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as VoucherVerification;
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
    const res = await fetch(
      `${API_BASE}/reviews${suffix ? `?${suffix}` : ""}`,
      {
        next: { revalidate: BROWSE_REVALIDATE_SECONDS },
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as PublicTestimonial[];
  } catch {
    return [];
  }
}

/** Areas for a city (notable first, then with-properties, then the rest). */
export async function getAreasForCity(city: string): Promise<AreaOption[]> {
  try {
    const res = await fetch(
      `${API_BASE}/areas?city=${encodeURIComponent(city)}`,
      {
        next: { revalidate: BROWSE_REVALIDATE_SECONDS },
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as AreaOption[];
  } catch {
    return [];
  }
}
