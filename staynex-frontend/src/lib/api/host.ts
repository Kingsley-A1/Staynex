// Host (property-owner) endpoints. Authenticated by the session cookie.

import { request } from "./client";
import type {
  AvailabilityDay,
  BookingRow,
  MediaItem,
  MediaUploadTarget,
  OwnerBookingsView,
  OwnerLocationView,
  OwnerOnboardingState,
  OwnerPayoutMethodView,
  OwnerProfileView,
  OwnerSettingsView,
  PayoutBankDirectoryView,
  PropertyDetail,
  PropertySummary,
  ResolvedPayoutAccount,
} from "@/lib/types";

interface LocationInput {
  cityId: string;
  areaId?: string | null;
  label?: string | null;
  addressLine?: string | null;
  isPrimary?: boolean;
}

interface PayoutMethodInput {
  bankCode: string;
  accountNumber: string;
}

export const hostApi = {
  listProperties: () => request<PropertySummary[]>("/host/properties"),
  getProperty: (id: string) =>
    request<PropertyDetail>(`/host/properties/${id}`),
  createProperty: (body: {
    name: string;
    cityId: string;
    areaId?: string | null;
    description?: string;
  }) =>
    request<PropertyDetail>("/host/properties", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProperty: (
    id: string,
    body: {
      name?: string;
      cityId?: string;
      areaId?: string | null;
      description?: string;
    },
  ) =>
    request<PropertyDetail>(`/host/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  submitProperty: (id: string) =>
    request<PropertyDetail>(`/host/properties/${id}/submit`, {
      method: "POST",
    }),
  deleteProperty: (id: string) =>
    request<{ id: string; status: "ARCHIVED" }>(
      `/host/properties/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  createRoomType: (body: {
    propertyId: string;
    name: string;
    basePriceKobo: number;
    maxGuests: number;
    unitCount?: number;
    description?: string;
  }) =>
    request<unknown>("/host/room-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoomType: (
    id: string,
    body: {
      name?: string;
      basePriceKobo?: number;
      maxGuests?: number;
      description?: string;
    },
  ) =>
    request<unknown>(`/host/room-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  addRoomUnit: (body: { roomTypeId: string; code?: string }) =>
    request<unknown>("/host/room-units", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeRoomUnit: (roomTypeId: string) =>
    request<{ unitCount: number }>(
      `/host/room-types/${encodeURIComponent(roomTypeId)}/units`,
      { method: "DELETE" },
    ),
  requestUpload: (body: {
    scope: "property" | "room";
    filename: string;
    contentType: string;
  }) =>
    request<MediaUploadTarget>("/host/media/upload-url", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Attach is by storage KEY (from requestUpload) — the backend verifies the
  // object and derives the public URL itself; clients never supply URLs.
  attachPropertyMedia: (
    propertyId: string,
    body: { key: string; altText?: string },
  ) =>
    request<MediaItem>(`/host/media/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attachRoomMedia: (
    roomTypeId: string,
    body: { key: string; altText?: string },
  ) =>
    request<MediaItem>(`/host/media/room/${roomTypeId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deletePropertyMedia: (mediaId: string) =>
    request<{ ok: true }>(`/host/media/property-media/${mediaId}`, {
      method: "DELETE",
    }),
  deleteRoomMedia: (mediaId: string) =>
    request<{ ok: true }>(`/host/media/room-media/${mediaId}`, {
      method: "DELETE",
    }),
  updatePropertyMediaAlt: (mediaId: string, altText: string | null) =>
    request<MediaItem>(`/host/media/property-media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify({ altText }),
    }),
  updateRoomMediaAlt: (mediaId: string, altText: string | null) =>
    request<MediaItem>(`/host/media/room-media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify({ altText }),
    }),
  /** Full new order for a gallery — first id becomes the cover. */
  reorderPropertyMedia: (propertyId: string, mediaIds: string[]) =>
    request<MediaItem[]>(`/host/media/property/${propertyId}/order`, {
      method: "PUT",
      body: JSON.stringify({ mediaIds }),
    }),
  reorderRoomMedia: (roomTypeId: string, mediaIds: string[]) =>
    request<MediaItem[]>(`/host/media/room/${roomTypeId}/order`, {
      method: "PUT",
      body: JSON.stringify({ mediaIds }),
    }),
  setCapacity: (body: {
    roomTypeId: string;
    from: string;
    to: string;
    totalUnits: number;
  }) =>
    request<{ updatedDays: number }>("/availability/capacity", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getCalendar: (roomTypeId: string, from: string, to: string) =>
    request<AvailabilityDay[]>(
      `/availability/room-types/${roomTypeId}?from=${from}&to=${to}`,
    ),
  listBookings: () => request<OwnerBookingsView>("/host/bookings"),
  getBooking: (id: string) => request<BookingRow>(`/host/bookings/${id}`),
};

/** Search/filter/pagination inputs for the admin money lists. */
export interface AdminListQuery {
  q?: string;
  status?: string;
  cursor?: string;
  take?: number;
}

export const hostApiSettings = {
  onboarding: () => request<OwnerOnboardingState>("/host/onboarding"),
  completeOnboarding: (skipPayout?: boolean) =>
    request<OwnerOnboardingState>("/host/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ skipPayout: skipPayout ?? false }),
    }),
  settings: () => request<OwnerSettingsView>("/host/settings"),
  updateProfile: (body: {
    displayName?: string;
    businessName?: string;
    phone?: string;
  }) =>
    request<OwnerProfileView>("/host/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listLocations: () => request<OwnerLocationView[]>("/host/settings/locations"),
  createLocation: (body: LocationInput) =>
    request<OwnerLocationView>("/host/settings/locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: Partial<LocationInput>) =>
    request<OwnerLocationView>(`/host/settings/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string, replacementLocationId?: string) =>
    request<OwnerLocationView[]>(
      `/host/settings/locations/${id}${
        replacementLocationId
          ? `?replacementLocationId=${encodeURIComponent(replacementLocationId)}`
          : ""
      }`,
      { method: "DELETE" },
    ),
  getPayoutMethod: () =>
    request<OwnerPayoutMethodView | null>("/host/settings/payout-method"),
  payoutBanks: () =>
    request<PayoutBankDirectoryView>("/host/settings/payout-banks"),
  verifyPayoutAccount: (body: PayoutMethodInput) =>
    request<ResolvedPayoutAccount>("/host/settings/payout-method/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  savePayoutMethod: (body: PayoutMethodInput) =>
    request<OwnerPayoutMethodView>("/host/settings/payout-method", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
