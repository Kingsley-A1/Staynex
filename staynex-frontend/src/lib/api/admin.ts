// Admin endpoints: approvals, bookings, payments, payouts, users, audit.

import { request } from "./client";
import type {
  AdminBookingsPage,
  AdminCityRow,
  AdminLocationReferenceView,
  AdminPaymentExceptionRow,
  AdminPaymentRow,
  AdminPaymentsPage,
  AdminPayoutRow,
  AdminPayoutsView,
  AdminPerformanceView,
  AdminTestimonialRow,
  AdminUserDetail,
  AdminUserRow,
  AiLogRow,
  ApprovalActionResult,
  AreaOption,
  AuditLogRow,
  AvailabilityDriftRow,
  PropertyDetail,
  PropertySummary,
  RevealedPayoutMethod,
} from "@/lib/types";

export interface AdminListQuery {
  q?: string;
  status?: string;
  cursor?: string;
  take?: number;
}

export function adminListQueryString(query?: AdminListQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.take) params.set("take", String(query.take));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  queue: () => request<PropertySummary[]>("/admin/approvals"),
  getForReview: (id: string) =>
    request<PropertyDetail>(`/admin/approvals/${id}`),
  decide: (
    id: string,
    body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string },
  ) =>
    request<ApprovalActionResult>(`/admin/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteProperty: (id: string) =>
    request<{ id: string; status: "ARCHIVED" }>(
      `/admin/properties/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  bookings: (query?: AdminListQuery) =>
    request<AdminBookingsPage>(`/admin/bookings${adminListQueryString(query)}`),
  payments: (query?: AdminListQuery) =>
    request<AdminPaymentsPage>(`/admin/payments${adminListQueryString(query)}`),
  paymentExceptions: () =>
    request<AdminPaymentExceptionRow[]>("/admin/payments/exceptions"),
  reverifyPayment: (reference: string) =>
    request<AdminPaymentRow>(
      `/admin/payments/${encodeURIComponent(reference)}/reverify`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  refundPayment: (reference: string, note?: string) =>
    request<AdminPaymentRow>(
      `/admin/payments/${encodeURIComponent(reference)}/refund`,
      { method: "POST", body: JSON.stringify(note ? { note } : {}) },
    ),
  availabilityDrift: () =>
    request<AvailabilityDriftRow[]>("/admin/reconciliation/availability"),
  payouts: () => request<AdminPayoutsView>("/admin/payouts"),
  markPayoutPaid: (
    id: string,
    body: { note?: string; overrideEligibility?: boolean } = {},
  ) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/paid`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markPayoutFailed: (id: string, reason: string) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/failed`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  auditLogs: () => request<AuditLogRow[]>("/admin/audit-logs"),
  performance: () => request<AdminPerformanceView>("/admin/performance"),
  aiLogs: () => request<AiLogRow[]>("/admin/ai-logs"),
  testimonials: (status?: string) =>
    request<AdminTestimonialRow[]>(
      `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  moderateTestimonial: (
    id: string,
    decision: "APPROVE" | "REJECT" | "PENDING",
  ) =>
    request<{ id: string; status: string }>(
      `/admin/testimonials/${id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision }),
      },
    ),
  areas: (city?: string) =>
    request<AreaOption[]>(
      `/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`,
    ),
  createArea: (body: {
    cityId: string;
    name: string;
    type: string;
    notable?: boolean;
  }) =>
    request<AreaOption>("/admin/areas", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateArea: (
    id: string,
    body: { name?: string; type?: string; notable?: boolean },
  ) =>
    request<AreaOption>(`/admin/areas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteArea: (id: string) =>
    request<{ ok: true }>(`/admin/areas/${id}`, { method: "DELETE" }),
  cities: () => request<AdminCityRow[]>("/admin/cities"),
  locationReferences: () =>
    request<AdminLocationReferenceView>("/admin/cities/reference"),
  createCity: (body: {
    countryId: string;
    regionId?: string | null;
    name: string;
  }) =>
    request<AdminCityRow>("/admin/cities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCity: (
    id: string,
    body: { countryId?: string; regionId?: string | null; name?: string },
  ) =>
    request<AdminCityRow>(`/admin/cities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCity: (id: string) =>
    request<{ ok: true }>(`/admin/cities/${id}`, { method: "DELETE" }),
};

export const adminUsersApi = {
  list: () => request<AdminUserRow[]>("/admin/users"),
  get: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
  revealPayout: (id: string) =>
    request<RevealedPayoutMethod>(`/admin/users/${id}/payout-method/reveal`, {
      method: "POST",
    }),
};
