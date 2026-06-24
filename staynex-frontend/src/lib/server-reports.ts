// Server-only fetch helpers for owner/admin operational dashboards. These read
// real platform state (bookings, payments, audit, AI logs) and NEVER fall back
// to fixtures — operational truth must not be faked. On API failure they return
// `{ data: null, offline: true }` so pages render an honest "couldn't load"
// state instead of misleading numbers.

import type {
  AdminBookingsView,
  AdminTestimonialRow,
  AiLogRow,
  AreaOption,
  AuditLogRow,
  BookingRow,
  OwnerBookingsView,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DEMO_ADMIN_ID = "demo-admin";

export interface Loaded<T> {
  data: T | null;
  offline: boolean;
}

async function load<T>(path: string, userId?: string): Promise<Loaded<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: userId ? { "x-user-id": userId } : undefined,
    });
    if (!res.ok) return { data: null, offline: false };
    return { data: (await res.json()) as T, offline: false };
  } catch {
    return { data: null, offline: true };
  }
}

export const getOwnerBookings = (userId: string) =>
  load<OwnerBookingsView>("/owner/bookings", userId);

export const getOwnerBooking = (userId: string, id: string) =>
  load<BookingRow>(`/owner/bookings/${id}`, userId);

export const getAdminBookings = () => load<AdminBookingsView>("/admin/bookings", DEMO_ADMIN_ID);

export const getAuditLogs = () => load<AuditLogRow[]>("/admin/audit-logs", DEMO_ADMIN_ID);

export const getAiLogs = () => load<AiLogRow[]>("/admin/ai-logs", DEMO_ADMIN_ID);

export const getAdminTestimonials = (status?: string) =>
  load<AdminTestimonialRow[]>(
    `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    DEMO_ADMIN_ID,
  );

export const getAdminAreas = (city?: string) =>
  load<AreaOption[]>(`/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`, DEMO_ADMIN_ID);
