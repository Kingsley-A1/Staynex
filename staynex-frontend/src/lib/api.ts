// Typed API client for owner/admin surfaces. Calls the NestJS backend over HTTP
// (the frontend never touches Prisma/DB). Used by client components; server
// components render from centralized fixtures until the API is wired live.

import type {
  ApprovalActionResult,
  AvailabilityDay,
  AvailabilityQuote,
  BookingView,
  CheckoutResult,
  HoldSummary,
  MediaItem,
  MediaUploadTarget,
  PaymentStatusView,
  PropertyDetail,
  PropertySummary,
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
