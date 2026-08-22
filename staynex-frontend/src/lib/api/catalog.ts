// Public catalog, reviews, areas, and guest booking endpoints.

import { request } from "./client";
import type {
  AreaOption,
  AvailabilityQuote,
  BookingReviewContext,
  BookingView,
  CheckoutResult,
  CityOption,
  HoldSummary,
  PaymentStatusView,
  PropertySummary,
  PublicTestimonial,
  AssistantRecovery,
} from "@/lib/types";

type BookingDates = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
};

export const catalogApi = {
  cities: () => request<CityOption[]>("/catalog/cities"),
};

export const reviewsApi = {
  list: (propertySlug?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (propertySlug) qs.set("propertySlug", propertySlug);
    if (limit) qs.set("limit", String(limit));
    const suffix = qs.toString();
    return request<PublicTestimonial[]>(
      `/reviews${suffix ? `?${suffix}` : ""}`,
    );
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

/** Metadata delivered by the final `done` event of a streamed reply. */
export interface AgentStreamMeta {
  conversationId: string;
  userMessageId: string;
  messageId: string;
  refused: boolean;
  unavailable: boolean;
  groundedFacts: string[];
  properties: PropertySummary[];
  recovery: AssistantRecovery;
  requestId: string;
}

export type AssistantOperation =
  | { type: "retry"; assistantMessageId: string }
  | { type: "edit"; userMessageId: string };

export interface AssistantRequest {
  message: string;
  conversationId?: string;
  propertySlug?: string;
  pagePath?: string;
  operation?: AssistantOperation;
}

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
  getHold: (holdId: string) =>
    request<HoldSummary>(`/bookings/holds/${holdId}`),
  checkout: (body: { holdId: string; email: string }) =>
    request<CheckoutResult>("/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPaymentStatus: (reference: string) =>
    request<PaymentStatusView>(`/payments/${encodeURIComponent(reference)}`),
  getBooking: (id: string) => request<BookingView>(`/bookings/${id}`),
};

/**
 * Direct PUT of a file to a storage upload target (step 2 of the media flow).
 * Uses XHR so callers can render real upload progress — fetch has no
 * upload-progress events.
 */
