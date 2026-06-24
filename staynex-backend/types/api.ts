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

// --- Phase 4: dashboards, notifications, AI logs ---

/** A booking row for owner/admin lists. Guest fields are nullable (anonymous). */
export interface BookingRow {
  id: string;
  status: BookingStatus;
  propertyName: string;
  cityName: string;
  roomName: string;
  guestEmail: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountKobo: number;
  currency: string;
  paymentStatus: PaymentState;
  paymentReference: string | null;
  createdAt: string;
}

export interface OwnerBookingKpis {
  confirmedBookings: number;
  pendingPayments: number;
  availableRooms: number;
  estimatedEarningsKobo: number;
  currency: string;
}

export interface OwnerBookingsView {
  kpis: OwnerBookingKpis;
  bookings: BookingRow[];
}

export interface AdminPaymentRow {
  reference: string | null;
  bookingId: string;
  propertyName: string;
  amountKobo: number;
  currency: string;
  provider: string | null;
  status: PaymentState;
  createdAt: string;
}

export interface AdminBookingsView {
  bookings: BookingRow[];
  payments: AdminPaymentRow[];
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  propertyId: string | null;
  createdAt: string;
}

export interface AiLogRow {
  id: string;
  conversationId: string;
  actionType: string;
  summary: string | null;
  createdAt: string;
}

// --- Phase 4: AI assistant ---

export interface AssistantReply {
  conversationId: string;
  reply: string;
  /** True when the assistant declined an unsafe/operational request. */
  refused: boolean;
  /** True when the AI provider is not configured/reachable. */
  unavailable: boolean;
  /** Verified facts the answer was grounded in (e.g. room prices). */
  groundedFacts: string[];
}

// --- Phase 5: auth, testimonials, areas ---

export type AppRole = "GUEST" | "OWNER" | "ADMIN_REVIEWER" | "ADMIN_MANAGER";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: AppRole;
}

export type TestimonialStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

/** Public-safe testimonial — only APPROVED ones are ever returned here. */
export interface PublicTestimonial {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  guestName: string | null;
  propertyName: string;
  propertySlug: string;
  cityName: string;
  createdAt: string;
}

export interface AdminTestimonialRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  guestName: string | null;
  propertyName: string;
  cityName: string;
  status: TestimonialStatus;
  bookingId: string;
  createdAt: string;
}

/** What a guest can submit for a booking + whether they already have. */
export interface BookingReviewContext {
  bookingId: string;
  propertyName: string;
  roomName: string;
  canReview: boolean;
  alreadyReviewed: boolean;
  reason: string | null;
}

export type AreaTypeValue = "LOCAL_GOVERNMENT_AREA" | "NEIGHBORHOOD";

export interface AreaOption {
  id: string;
  name: string;
  slug: string;
  type: AreaTypeValue;
  notable: boolean;
  /** True when at least one APPROVED property sits in this area. */
  hasProperties: boolean;
}
