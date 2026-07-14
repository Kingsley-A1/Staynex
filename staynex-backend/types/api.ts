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

export type PropertyReviewStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "FAILED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "CANCELLED"
  | "MANUAL_REVIEW";

export type PropertyReviewSource = "AUTO_REVIEW" | "ADMIN_OVERRIDE";

export type PropertyReviewCheckStatus = "PASS" | "FAIL" | "WARNING";

export type PropertyReviewCheckKey =
  | "owner_identity"
  | "payout_ready"
  | "property_details"
  | "location_ready"
  | "media_ready"
  | "rooms_ready"
  | "availability_ready"
  | "duplicate_listing"
  | "content_safety";

export interface PropertyReviewCheckView {
  id: string;
  key: PropertyReviewCheckKey;
  label: string;
  status: PropertyReviewCheckStatus;
  severity: string;
  details: string;
}

export interface PropertyReviewRunView {
  id: string;
  source: PropertyReviewSource;
  status: PropertyReviewStatus;
  riskScore: number;
  summary: string | null;
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  checks: PropertyReviewCheckView[];
}

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
  reviewStatus: PropertyReviewStatus;
  reviewSource: PropertyReviewSource | null;
  reviewedAt: string | null;
  scheduledPublishAt: string | null;
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
  latestReview: PropertyReviewRunView | null;
}

export interface DestinationShowcase {
  cityName: string;
  citySlug: string;
  stayCount: number;
  propertyImageUrls: string[];
}

export interface HomeCatalogView {
  latestProperties: PropertySummary[];
  mostBookedProperties: PropertySummary[];
  destinations: DestinationShowcase[];
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
  /** Funds captured but the booking can't be honored — needs an admin refund. */
  | "REQUIRES_REFUND"
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
  adults: number;
  children: number;
  infants: number;
  amountKobo: number;
  currency: string;
  propertyName: string;
  propertySlug: string;
  cityName: string;
  roomName: string;
  /** Internal unit code — provisional; the physical room is set at check-in. */
  unitCode: string | null;
  paymentStatus: PaymentState;
  paymentReference: string | null;
}

/**
 * Public, unauthenticated booking-verification card (GET /verify/:reference).
 * Backed by live server truth so an on-site receptionist can trust it over any
 * screenshot. Deliberately omits the amount and card data — proof of a real,
 * paid booking without leaking price or PII to whoever holds the QR.
 */
export interface VoucherVerification {
  /** True only when the booking is CONFIRMED and its payment is SUCCESS. */
  valid: boolean;
  status: "CONFIRMED" | "PENDING" | "CANCELLED" | "NOT_FOUND";
  reference: string;
  guestName: string | null;
  guestEmailMasked: string | null;
  propertyName: string | null;
  cityName: string | null;
  areaName: string | null;
  roomTypeName: string | null;
  unitCode: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guests: { adults: number; children: number; infants: number } | null;
  confirmedAt: string | null;
}

// --- Phase 4: dashboards, notifications, AI logs ---

/** Payout lifecycle (owner settlement of a successful payment). */
export type PayoutStatusValue = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

/**
 * A booking row for owner/admin lists. Guest fields are nullable (anonymous).
 * Money is split: `grossAmountKobo` (guest charge) = `platformFeeKobo` (Staynex
 * commission) + `ownerPayoutKobo` (owner net). `amountKobo` is kept as a COMPAT
 * mirror of gross. `payoutStatus` is null until a payout exists.
 */
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
  /** Occupancy split. Capacity = adults + children; infants are free. */
  adults: number;
  children: number;
  infants: number;
  amountKobo: number;
  grossAmountKobo: number;
  platformFeeKobo: number;
  ownerPayoutKobo: number;
  currency: string;
  paymentStatus: PaymentState;
  paymentReference: string | null;
  payoutStatus: PayoutStatusValue | null;
  createdAt: string;
}

export interface OwnerBookingKpis {
  confirmedBookings: number;
  pendingPayments: number;
  availableRooms: number;
  /** Net owner earnings after commission, from SUCCESS payments (kobo). */
  netEarningsKobo: number;
  /** Owed but not yet settled to the owner (PENDING/PROCESSING payouts, kobo). */
  pendingPayoutKobo: number;
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
  guestEmail: string | null;
  amountKobo: number;
  grossAmountKobo: number;
  platformFeeKobo: number;
  ownerPayoutKobo: number;
  currency: string;
  provider: string | null;
  status: PaymentState;
  paidAt: string | null;
  payoutStatus: PayoutStatusValue | null;
  createdAt: string;
}

/** Cursor-paginated admin list page (cursor is opaque; null = end). */
export interface AdminBookingsPage {
  rows: BookingRow[];
  nextCursor: string | null;
}

export interface AdminPaymentsPage {
  rows: AdminPaymentRow[];
  nextCursor: string | null;
}

/** One entry in a payment's money audit timeline. */
export interface AdminPaymentEventRow {
  id: string;
  eventType: string;
  outcome: string;
  detail: string | null;
  createdAt: string;
}

/**
 * A payment where funds moved but the platform owes a human action
 * (REQUIRES_REFUND: late success without capacity, underpayment, currency
 * mismatch). This queue must trend to empty.
 */
export interface AdminPaymentExceptionRow {
  reference: string | null;
  bookingId: string;
  bookingStatus: BookingStatus;
  propertyName: string;
  guestEmail: string | null;
  grossAmountKobo: number;
  currency: string;
  status: PaymentState;
  createdAt: string;
  updatedAt: string;
  events: AdminPaymentEventRow[];
}

// --- Notifications ---

export type NotificationTypeValue =
  | "BOOKING_CONFIRMED"
  | "BOOKING_REFUNDED"
  | "PAYOUT_PAID"
  | "PAYOUT_FAILED"
  | "PAYMENT_EXCEPTION"
  | "PROPERTY_REVIEW"
  | "CHECKIN_REMINDER"
  | "GENERAL";

/** One in-app inbox item (what the notification bell renders). */
export interface NotificationRow {
  id: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  rows: NotificationRow[];
  nextCursor: string | null;
  unreadCount: number;
}

/** A calendar day whose counters disagree with live holds/bookings (P10). */
export interface AvailabilityDriftRow {
  roomTypeId: string;
  roomName: string;
  propertyName: string;
  date: string;
  totalUnits: number;
  heldUnits: number;
  expectedHeldUnits: number;
  bookedUnits: number;
  expectedBookedUnits: number;
}

/** A row in the admin payout (owner settlement) queue. */
export interface AdminPayoutRow {
  id: string;
  bookingId: string;
  paymentReference: string | null;
  propertyName: string;
  cityName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  grossAmountKobo: number;
  platformFeeKobo: number;
  ownerPayoutKobo: number;
  currency: string;
  status: PayoutStatusValue;
  /** Settlement destination (masked) — where the admin actually sends money. */
  bankName: string | null;
  accountName: string | null;
  accountNumberLast4: string | null;
  /** Settlement reference on PAID, reason on FAILED, clawback note on refunds. */
  note: string | null;
  /** When the payout becomes eligible to settle (checkIn + 24h). */
  eligibleAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

/** Platform-wide settlement totals (kobo). */
export interface PayoutTotals {
  grossRevenueKobo: number;
  platformCommissionKobo: number;
  ownerPayoutKobo: number;
  pendingPayoutKobo: number;
  paidPayoutKobo: number;
}

export interface AdminPayoutsView {
  payouts: AdminPayoutRow[];
  totals: PayoutTotals;
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

// --- Phase 4 / Staynex AI ---

export interface AssistantReply {
  conversationId: string;
  reply: string;
  /** True when the agent declined an unsafe/operational request. */
  refused: boolean;
  /** True when the AI provider is not configured/reachable. */
  unavailable: boolean;
  /** Verified facts the answer was grounded in (e.g. room prices). */
  groundedFacts: string[];
  /** Truthful recovery classification; app and provider limits stay distinct. */
  recovery: AssistantRecovery;
  /** Opaque diagnostics reference safe to share with support. */
  requestId: string;
}

export type AssistantRecovery =
  | "none"
  | "application_throttled"
  | "provider_rate_limited"
  | "provider_overloaded"
  | "provider_timeout"
  | "provider_unconfigured"
  | "provider_error"
  | "partial_response"
  | "transport_interrupted";

export type AgentMessageRole = "USER" | "AGENT";

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  title: string | null;
  pinned: boolean;
  updatedAt: string;
  /** Short excerpt of the latest message, for history-list previews. */
  preview: string | null;
}

// --- Phase 5: auth, testimonials, areas ---

export type AppRole = "GUEST" | "OWNER" | "ADMIN_REVIEWER" | "ADMIN_MANAGER";

/**
 * Additive capability set. GUEST is always present for a signed-in user; owner
 * and admin privileges are layered on top. `role` is the compatibility mirror.
 */
export type AppCapability =
  | "GUEST"
  | "OWNER"
  | "ADMIN_REVIEWER"
  | "ADMIN_MANAGER";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  /** COMPAT primary role. Prefer `capabilities` for access decisions. */
  role: AppRole;
  /** Always includes "GUEST"; "OWNER"/"ADMIN_*" added when granted. */
  capabilities: AppCapability[];
}

export interface AuthMfaChallenge {
  mfaRequired: true;
  challengeId: string;
  email: string;
  expiresAt: string;
}

export type AuthResponse = AuthUser | AuthMfaChallenge;

export interface SessionSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

// --- Owner v1: onboarding, locations, payout, settings ---

export type PayoutMethodStatusValue =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "DISABLED";

export interface OwnerProfileView {
  /** Display name (User.name). */
  displayName: string | null;
  businessName: string | null;
  phone: string | null;
  onboardingCompletedAt: string | null;
}

export interface OwnerLocationView {
  id: string;
  cityId: string;
  cityName: string;
  areaId: string | null;
  areaName: string | null;
  label: string | null;
  addressLine: string | null;
  isPrimary: boolean;
  /** Listings currently linked to this location (blocks naive deletion). */
  propertyCount: number;
  createdAt: string;
}

/** Masked payout method — never includes the full account number. */
export interface OwnerPayoutMethodView {
  id: string;
  bankCode: string | null;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  provider: string | null;
  status: PayoutMethodStatusValue;
  /** True when the full number is encrypted at rest and can be revealed by a Super Admin. */
  hasEncryptedNumber: boolean;
  updatedAt: string;
}

export interface PayoutBankOption {
  code: string;
  name: string;
  provider: "paystack";
}

export interface PayoutBankDirectoryView {
  banks: PayoutBankOption[];
  source: "paystack" | "cache";
  refreshedAt: string;
}

export interface ResolvedPayoutAccount {
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  provider: "paystack";
}

/** Resume-safe snapshot the onboarding flow reads to know what's left. */
export interface OwnerOnboardingState {
  profile: OwnerProfileView;
  locations: OwnerLocationView[];
  payoutMethod: OwnerPayoutMethodView | null;
  /** Owner explicitly chose to add payout later. */
  payoutSkipped: boolean;
  readiness: {
    hasBusinessName: boolean;
    hasPhone: boolean;
    hasLocation: boolean;
    hasPayoutOrSkipped: boolean;
    complete: boolean;
  };
  propertyCount: number;
}

export interface OwnerSettingsView {
  profile: OwnerProfileView;
  locations: OwnerLocationView[];
  payoutMethod: OwnerPayoutMethodView | null;
}

// --- Admin user management ---

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  capabilities: AppCapability[];
  isOwner: boolean;
  isAdmin: boolean;
  propertyCount: number;
  bookingCount: number;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  name: string | null;
  email: string | null;
  /** Populated only for ADMIN_MANAGER; null + `phoneRestricted` for reviewers. */
  phone: string | null;
  phoneRestricted: boolean;
  role: AppRole;
  capabilities: AppCapability[];
  createdAt: string;
  ownerProfile: OwnerProfileView | null;
  ownerLocations: OwnerLocationView[];
  /** Populated only for ADMIN_MANAGER; null + `payoutRestricted` for reviewers. */
  payoutMethod: OwnerPayoutMethodView | null;
  payoutRestricted: boolean;
  counts: {
    properties: number;
    bookings: number;
  };
  /** Net owner settlement summary (kobo), cheap aggregates. */
  payoutSummary: {
    paidKobo: number;
    pendingKobo: number;
    currency: string;
  };
}

/** Full account number reveal — ADMIN_MANAGER only, always audited. */
export interface RevealedPayoutMethod {
  ownerId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  provider: string | null;
}

/** Public city option for owner location / property forms (real DB ids). */
export interface CityOption {
  id: string;
  name: string;
  slug: string;
}

export interface AdminLocationReferenceView {
  countries: Array<{ id: string; name: string; code: string }>;
  regions: Array<{ id: string; countryId: string; name: string; slug: string }>;
}

export interface AdminCityRow extends CityOption {
  countryId: string;
  countryName: string;
  regionId: string | null;
  regionName: string | null;
  areaCount: number;
  propertyCount: number;
  ownerLocationCount: number;
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
