// Server-only fetch helpers for owner/admin operational dashboards. These read
// real platform state (bookings, payments, audit, AI logs) and NEVER fall back
// to fixtures — operational truth must not be faked. Auth is session-only: the
// incoming request's cookies are forwarded to the backend, which resolves the
// owner/admin from the session. On API failure they return
// `{ data: null, offline: true }` so pages render an honest "couldn't load" state.

import { cookies } from "next/headers";
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

export interface Loaded<T> {
  data: T | null;
  offline: boolean;
}

async function authHeaders(): Promise<HeadersInit | undefined> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return undefined;
  return { cookie: all.map((c) => `${c.name}=${c.value}`).join("; ") };
}

async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    if (!res.ok) return { data: null, offline: false };
    return { data: (await res.json()) as T, offline: false };
  } catch {
    return { data: null, offline: true };
  }
}

export const getOwnerBookings = () => load<OwnerBookingsView>("/owner/bookings");

export const getOwnerBooking = (id: string) => load<BookingRow>(`/owner/bookings/${id}`);

export const getAdminBookings = () => load<AdminBookingsView>("/admin/bookings");

export const getAuditLogs = () => load<AuditLogRow[]>("/admin/audit-logs");

export const getAiLogs = () => load<AiLogRow[]>("/admin/ai-logs");

export const getAdminTestimonials = (status?: string) =>
  load<AdminTestimonialRow[]>(
    `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
  );

export const getAdminAreas = (city?: string) =>
  load<AreaOption[]>(`/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`);
