// Typed API service functions. Every shape is `import type`'d from the canonical
// backend contract — there are no local copies of any API type (skill.md §7).

import type {
  AreaOption,
  AuthUser,
  AvailabilityDay,
  AvailabilityQuote,
  BookingView,
  CheckoutResult,
  CityOption,
  HoldSummary,
  PaymentStatusView,
  PropertyDetail,
  PropertySummary,
} from "@staynex/backend/types";
import { api } from "@/core/client";

/** Date range + room used by quote and hold (same body shape on the backend). */
export interface BookingDatesInput {
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
}

export interface SearchInput {
  city: string;
  area?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

function searchQuery(input: SearchInput): string {
  const qs = new URLSearchParams({ city: input.city });
  if (input.area) qs.set("area", input.area);
  if (input.checkIn) qs.set("checkIn", input.checkIn);
  if (input.checkOut) qs.set("checkOut", input.checkOut);
  if (input.guests) qs.set("guests", String(input.guests));
  return qs.toString();
}

export const catalogApi = {
  cities: () => api.get<CityOption[]>("/catalog/cities"),
  search: (input: SearchInput) => api.get<PropertySummary[]>(`/search?${searchQuery(input)}`),
  stay: (slug: string) => api.get<PropertyDetail>(`/stays/${encodeURIComponent(slug)}`),
};

export const areasApi = {
  listForCity: (city: string) =>
    api.get<AreaOption[]>(`/areas?city=${encodeURIComponent(city)}`),
};

export const availabilityApi = {
  calendar: (roomTypeId: string, from: string, to: string) =>
    api.get<AvailabilityDay[]>(
      `/availability/room-types/${encodeURIComponent(roomTypeId)}?from=${from}&to=${to}`,
    ),
};

export const bookingApi = {
  quote: (body: BookingDatesInput) => api.post<AvailabilityQuote>("/bookings/quote", body),
  createHold: (body: BookingDatesInput) => api.post<HoldSummary>("/bookings/holds", body),
  getHold: (holdId: string) =>
    api.get<HoldSummary>(`/bookings/holds/${encodeURIComponent(holdId)}`),
  checkout: (body: { holdId: string; email: string }) =>
    api.post<CheckoutResult>("/checkout", body),
  paymentStatus: (reference: string) =>
    api.get<PaymentStatusView>(`/payments/${encodeURIComponent(reference)}`),
  getBooking: (id: string) => api.get<BookingView>(`/bookings/${encodeURIComponent(id)}`),
};

export const authApi = {
  me: () => api.get<AuthUser | null>("/auth/me"),
  login: (body: { email: string; password: string }) =>
    api.post<AuthUser>("/auth/login", body),
  register: (body: { email: string; password: string; name?: string; role?: "GUEST" | "OWNER" }) =>
    api.post<AuthUser>("/auth/register", body),
  logout: () => api.post<{ ok: true }>("/auth/logout"),
};
