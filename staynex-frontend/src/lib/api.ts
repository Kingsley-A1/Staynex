// Typed API client for owner/admin surfaces. Calls the NestJS backend over HTTP
// (the frontend never touches Prisma/DB). Used by client components; server
// components render from centralized fixtures until the API is wired live.

import type {
  AdminBookingsView,
  AdminPayoutRow,
  AdminPayoutsView,
  AdminTestimonialRow,
  AgentConversation,
  AgentMessage,
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
import { API_BASE } from "@/lib/api-base";

type RequestOptions = RequestInit;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // Send/receive the session cookie so auth-aware endpoints resolve the user.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// All owner endpoints are authenticated by the session cookie (session-only auth).
export const ownerApi = {
  listProperties: () => request<PropertySummary[]>("/owner/properties"),
  getProperty: (id: string) => request<PropertyDetail>(`/owner/properties/${id}`),
  createProperty: (body: { name: string; cityId: string; description?: string }) =>
    request<PropertyDetail>("/owner/properties", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProperty: (id: string, body: { name?: string; cityId?: string; description?: string }) =>
    request<PropertyDetail>(`/owner/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  submitProperty: (id: string) =>
    request<PropertyDetail>(`/owner/properties/${id}/submit`, { method: "POST" }),
  createRoomType: (body: {
    propertyId: string;
    name: string;
    basePriceKobo: number;
    maxGuests: number;
    description?: string;
  }) =>
    request<unknown>("/owner/room-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addRoomUnit: (body: { roomTypeId: string; code?: string }) =>
    request<unknown>("/owner/room-units", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestUpload: (body: { scope: "property" | "room"; filename: string; contentType: string }) =>
    request<MediaUploadTarget>("/owner/media/upload-url", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attachPropertyMedia: (
    propertyId: string,
    body: { publicUrl: string; altText?: string; sortOrder?: number },
  ) =>
    request<MediaItem>(`/owner/media/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setCapacity: (body: { roomTypeId: string; from: string; to: string; totalUnits: number }) =>
    request<{ updatedDays: number }>("/availability/capacity", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getCalendar: (roomTypeId: string, from: string, to: string) =>
    request<AvailabilityDay[]>(
      `/availability/room-types/${roomTypeId}?from=${from}&to=${to}`,
    ),
  listBookings: () => request<OwnerBookingsView>("/owner/bookings"),
  getBooking: (id: string) => request<BookingRow>(`/owner/bookings/${id}`),
};

export const adminApi = {
  queue: () => request<PropertySummary[]>("/admin/approvals"),
  getForReview: (id: string) => request<PropertyDetail>(`/admin/approvals/${id}`),
  decide: (
    id: string,
    body: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string },
  ) =>
    request<ApprovalActionResult>(`/admin/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bookings: () => request<AdminBookingsView>("/admin/bookings"),
  payouts: () => request<AdminPayoutsView>("/admin/payouts"),
  markPayoutPaid: (id: string) =>
    request<AdminPayoutRow>(`/admin/payouts/${id}/paid`, { method: "POST" }),
  auditLogs: () => request<AuditLogRow[]>("/admin/audit-logs"),
  aiLogs: () => request<AiLogRow[]>("/admin/ai-logs"),
  testimonials: (status?: string) =>
    request<AdminTestimonialRow[]>(
      `/admin/testimonials${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  moderateTestimonial: (id: string, decision: "APPROVE" | "REJECT" | "PENDING") =>
    request<{ id: string; status: string }>(`/admin/testimonials/${id}/decision`, {
      method: "POST",
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
    accessCode: string;
  }) => request<AuthUser>("/auth/admin/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  google: (idToken: string) =>
    request<AuthUser>("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) }),
  updateProfile: (body: { name?: string; email?: string; phone?: string | null }) =>
    request<AuthUser>("/auth/profile", { method: "PATCH", body: JSON.stringify(body) }),
  deleteAccount: () => request<{ ok: true }>("/auth/profile", { method: "DELETE" }),
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

export const agentApi = {
  ask: (body: { message: string; conversationId?: string; propertySlug?: string }) =>
    request<AssistantReply>("/ai/assistant", { method: "POST", body: JSON.stringify(body) }),
  listConversations: () => request<AgentConversation[]>("/ai/conversations"),
  createConversation: (title?: string) =>
    request<AgentConversation>("/ai/conversations", {
      method: "POST",
      body: JSON.stringify(title ? { title } : {}),
    }),
  messages: (id: string) => request<AgentMessage[]>(`/ai/conversations/${id}/messages`),
  rename: (id: string, title: string) =>
    request<AgentConversation>(`/ai/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  setPinned: (id: string, pinned: boolean) =>
    request<AgentConversation>(`/ai/conversations/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/ai/conversations/${id}`, { method: "DELETE" }),
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
  createHold: (body: BookingDates) =>
    request<HoldSummary>("/bookings/holds", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getHold: (holdId: string) => request<HoldSummary>(`/bookings/holds/${holdId}`),
  checkout: (body: { holdId: string; email: string }) =>
    request<CheckoutResult>("/checkout", {
      method: "POST",
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
