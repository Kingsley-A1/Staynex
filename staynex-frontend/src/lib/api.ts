// Typed API client for owner/admin surfaces. Calls the NestJS backend over HTTP
// (the frontend never touches Prisma/DB). Used by client components; server
// components render from centralized fixtures until the API is wired live.

import type {
  AdminBookingsView,
  AdminTestimonialRow,
  ApprovalActionResult,
  AreaOption,
  AssistantReply,
  AuditLogRow,
  AuthUser,
  AiLogRow,
  AvailabilityDay,
  AvailabilityQuote,
  BookingReviewContext,
  BookingRow,
  BookingView,
  CheckoutResult,
  HoldSummary,
  MediaItem,
  MediaUploadTarget,
  OwnerBookingsView,
  PaymentStatusView,
  PropertyDetail,
  PropertySummary,
  PublicTestimonial,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Temporary identities until AuthModule lands; mirror the backend `x-user-id`.
export const DEMO_OWNER_ID = "demo-owner";
export const DEMO_ADMIN_ID = "demo-admin";

type RequestOptions = RequestInit & { userId?: string };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { userId, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // Send/receive the session cookie so auth-aware endpoints resolve the user.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const ownerApi = {
  listProperties: (userId: string) =>
    request<PropertySummary[]>("/owner/properties", { userId }),
  getProperty: (id: string) => request<PropertyDetail>(`/owner/properties/${id}`),
  createProperty: (
    userId: string,
    body: { name: string; cityId: string; description?: string },
  ) =>
    request<PropertyDetail>("/owner/properties", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  updateProperty: (
    userId: string,
    id: string,
    body: { name?: string; cityId?: string; description?: string },
  ) =>
    request<PropertyDetail>(`/owner/properties/${id}`, {
      method: "PATCH",
      userId,
      body: JSON.stringify(body),
    }),
  submitProperty: (userId: string, id: string) =>
    request<PropertyDetail>(`/owner/properties/${id}/submit`, {
      method: "POST",
      userId,
    }),
  createRoomType: (userId: string, body: {
    propertyId: string;
    name: string;
    basePriceKobo: number;
    maxGuests: number;
    description?: string;
  }) =>
    request<unknown>("/owner/room-types", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  addRoomUnit: (userId: string, body: { roomTypeId: string; code?: string }) =>
    request<unknown>("/owner/room-units", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  requestUpload: (userId: string, body: {
    scope: "property" | "room";
    filename: string;
    contentType: string;
  }) =>
    request<MediaUploadTarget>("/owner/media/upload-url", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  attachPropertyMedia: (
    userId: string,
    propertyId: string,
    body: { publicUrl: string; altText?: string; sortOrder?: number },
  ) =>
    request<MediaItem>(`/owner/media/property/${propertyId}`, {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  setCapacity: (userId: string, body: {
    roomTypeId: string;
    from: string;
    to: string;
    totalUnits: number;
  }) =>
    request<{ updatedDays: number }>("/availability/capacity", {
      method: "PUT",
      userId,
      body: JSON.stringify(body),
    }),
  getCalendar: (roomTypeId: string, from: string, to: string) =>
    request<AvailabilityDay[]>(
      `/availability/room-types/${roomTypeId}?from=${from}&to=${to}`,
    ),
  listBookings: (userId: string) =>
    request<OwnerBookingsView>("/owner/bookings", { userId }),
  getBooking: (userId: string, id: string) =>
    request<BookingRow>(`/owner/bookings/${id}`, { userId }),
};

export const adminApi = {
  queue: () => request<PropertySummary[]>("/admin/approvals"),
  getForReview: (id: string) => request<PropertyDetail>(`/admin/approvals/${id}`),
  decide: (
    userId: string,
    id: string,
    body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string },
  ) =>
    request<ApprovalActionResult>(`/admin/approvals/${id}/decision`, {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  bookings: () => request<AdminBookingsView>("/admin/bookings"),
  auditLogs: () => request<AuditLogRow[]>("/admin/audit-logs"),
  aiLogs: () => request<AiLogRow[]>("/admin/ai-logs"),
  testimonials: (status?: string) =>
    request<AdminTestimonialRow[]>(
      `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  moderateTestimonial: (
    userId: string,
    id: string,
    decision: "APPROVE" | "REJECT" | "PENDING",
  ) =>
    request<{ id: string; status: string }>(`/admin/testimonials/${id}/decision`, {
      method: "POST",
      userId,
      body: JSON.stringify({ decision }),
    }),
  areas: (city?: string) =>
    request<AreaOption[]>(`/admin/areas${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  createArea: (body: { cityId: string; name: string; type: string; notable?: boolean }) =>
    request<AreaOption>("/admin/areas", { method: "POST", body: JSON.stringify(body) }),
  updateArea: (id: string, body: { name?: string; type?: string; notable?: boolean }) =>
    request<AreaOption>(`/admin/areas/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export const authApi = {
  me: () => request<AuthUser | null>("/auth/me"),
  register: (body: { email: string; password: string; name?: string; role?: "GUEST" | "OWNER" }) =>
    request<AuthUser>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  adminRegister: (body: {
    email: string;
    password: string;
    name?: string;
    role: "ADMIN_REVIEWER" | "ADMIN_MANAGER";
    accessCode: string;
  }) => request<AuthUser>("/auth/admin/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
};

export const reviewsApi = {
  list: (propertySlug?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (propertySlug) qs.set("propertySlug", propertySlug);
    if (limit) qs.set("limit", String(limit));
    const suffix = qs.toString();
    return request<PublicTestimonial[]>(`/reviews${suffix ? `?${suffix}` : ""}`);
  },
  bookingContext: (bookingId: string) =>
    request<BookingReviewContext>(`/reviews/booking/${bookingId}/context`),
  submit: (
    bookingId: string,
    body: { rating: number; body: string; title?: string; guestName?: string },
  ) =>
    request<{ id: string; status: string }>(`/reviews/booking/${bookingId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const areasApi = {
  listForCity: (city: string) =>
    request<AreaOption[]>(`/areas?city=${encodeURIComponent(city)}`),
};

export const assistantApi = {
  ask: (
    body: { message: string; conversationId?: string; propertySlug?: string },
    userId?: string,
  ) =>
    request<AssistantReply>("/ai/assistant", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
};

type BookingDates = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export const guestApi = {
  quote: (body: BookingDates) =>
    request<AvailabilityQuote>("/bookings/quote", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createHold: (body: BookingDates, userId?: string) =>
    request<HoldSummary>("/bookings/holds", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  getHold: (holdId: string) => request<HoldSummary>(`/bookings/holds/${holdId}`),
  checkout: (body: { holdId: string; email: string }, userId?: string) =>
    request<CheckoutResult>("/checkout", {
      method: "POST",
      userId,
      body: JSON.stringify(body),
    }),
  getPaymentStatus: (reference: string) =>
    request<PaymentStatusView>(`/payments/${encodeURIComponent(reference)}`),
  getBooking: (id: string) => request<BookingView>(`/bookings/${id}`),
};

/** Direct PUT of a file to a storage upload target (step 2 of the media flow). */
export async function uploadToTarget(target: MediaUploadTarget, file: File): Promise<void> {
  const res = await fetch(target.uploadUrl, {
    method: target.method,
    headers: target.headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}
