// Canonical Phase 2 API contracts (backend-owned).
// The frontend keeps a mirrored, hand-copied set in
// `staynex-frontend/src/lib/types.ts` — there is no cross-package import, so the
// dependency direction stays one-way (frontend -> contracts <- backend).
// Money is always integer minor units (kobo).

export type PropertyStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export interface MediaItem {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface RoomTypeDetail {
  id: string;
  name: string;
  description: string | null;
  basePriceKobo: number;
  maxGuests: number;
  unitCount: number;
  media: MediaItem[];
}

export interface PropertySummary {
  id: string;
  name: string;
  slug: string;
  status: PropertyStatus;
  cityName: string;
  fromPriceKobo: number | null;
  roomTypeCount: number;
  coverImageUrl: string | null;
  updatedAt: string;
}

export interface PropertyDetail extends PropertySummary {
  description: string | null;
  media: MediaItem[];
  roomTypes: RoomTypeDetail[];
}

export interface MediaUploadTarget {
  key: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  totalUnits: number;
  bookedUnits: number;
  heldUnits: number;
  availableUnits: number;
}

export type PropertyStatusCounts = Record<PropertyStatus, number>;

export interface OwnerDashboardKpis {
  totalBookings: number;
  availableRooms: number;
  pendingActions: number;
  estimatedEarningsKobo: number;
  propertyStatus: PropertyStatusCounts;
}

export type ApprovalDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export interface ApprovalActionResult {
  id: string;
  status: PropertyStatus;
}

// --- Phase 3: guest booking + payment ---

export type BookingStatus =
  | "HOLD"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentState =
  | "INITIATED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "REFUNDED";

/** Verified availability + price for a room over a date range (kobo). */
export interface AvailabilityQuote {
  roomTypeId: string;
  propertyName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  available: number;
  nightlyPriceKobo: number;
  totalKobo: number;
  currency: string;
}

export interface HoldSummary {
  holdId: string;
  roomTypeId: string;
  propertyName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  nightlyPriceKobo: number;
  totalKobo: number;
  currency: string;
  expiresAt: string;
  expired: boolean;
}

export interface CheckoutResult {
  bookingId: string;
  reference: string;
  authorizationUrl: string;
}

export interface PaymentStatusView {
  reference: string;
  paymentStatus: PaymentState;
  bookingId: string;
  bookingStatus: BookingStatus;
}

export interface BookingView {
  id: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountKobo: number;
  currency: string;
  propertyName: string;
  propertySlug: string;
  cityName: string;
  roomName: string;
  paymentStatus: PaymentState;
  paymentReference: string | null;
}
