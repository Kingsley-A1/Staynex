// Server-only catalog fetch helpers for guest browse pages. They call the live
// API; when it is unreachable they fall back to centralized fixtures (DISPLAY
// ONLY). Booking/availability/payment are never faked — those go to the backend.

import {
  getApprovedPropertyBySlug,
  listApprovedProperties,
} from "@/features/properties/fixtures";
import type { BookingView, PropertyDetail, PropertySummary } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface SearchParams {
  city: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export async function searchProperties(
  params: SearchParams,
): Promise<{ items: PropertySummary[]; live: boolean }> {
  const qs = new URLSearchParams({ city: params.city });
  if (params.checkIn) qs.set("checkIn", params.checkIn);
  if (params.checkOut) qs.set("checkOut", params.checkOut);
  if (params.guests) qs.set("guests", String(params.guests));
  try {
    const res = await fetch(`${API_BASE}/search?${qs.toString()}`, { cache: "no-store" });
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
      cache: "no-store",
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
