// Server-only fetch helpers for host/admin operational dashboards. These read
// real platform state (bookings, payments, audit, AI logs) and NEVER fall back
// to fixtures — operational truth must not be faked. Auth is session-only: the
// incoming request's cookies are forwarded to the backend, which resolves the
// host/admin from the session. On API failure they return
// `{ data: null, offline: true }` so pages render an honest "couldn't load" state.

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/api-base";
import type {
  AdminBookingsPage,
  AdminPaymentExceptionRow,
  AdminPaymentsPage,
  AdminPerformanceView,
  AdminPayoutsView,
  AdminTestimonialRow,
  AiLogRow,
  AreaOption,
  AuditLogRow,
  BookingRow,
  OwnerBookingsView,
  PropertyDetail,
  PropertySummary,
} from "@/lib/types";
import { adminListQueryString, type AdminListQuery } from "@/lib/api";

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

export const getHostBookings = () => load<OwnerBookingsView>("/host/bookings");

export const getHostBooking = (id: string) =>
  load<BookingRow>(`/host/bookings/${id}`);

export const getAdminApprovals = () =>
  load<PropertySummary[]>("/admin/approvals");

export const getAdminProperties = () =>
  load<PropertySummary[]>("/admin/properties");

export const getAdminApproval = (id: string) =>
  load<PropertyDetail>(`/admin/approvals/${id}`);

export const getAdminBookings = (query?: AdminListQuery) =>
  load<AdminBookingsPage>(`/admin/bookings${adminListQueryString(query)}`);

export const getAdminPayments = (query?: AdminListQuery) =>
  load<AdminPaymentsPage>(`/admin/payments${adminListQueryString(query)}`);

export const getAdminPaymentExceptions = () =>
  load<AdminPaymentExceptionRow[]>("/admin/payments/exceptions");

export const getAdminPayouts = () => load<AdminPayoutsView>("/admin/payouts");

export const getAuditLogs = () => load<AuditLogRow[]>("/admin/audit-logs");

export const getAdminPerformance = () => load<AdminPerformanceView>("/admin/performance");

export const getAiLogs = () => load<AiLogRow[]>("/admin/ai-logs");

export const getAdminTestimonials = (status?: string) =>
  load<AdminTestimonialRow[]>(
    `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
  );

export const getAdminAreas = (city?: string) =>
  load<AreaOption[]>(
    `/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`,
  );
