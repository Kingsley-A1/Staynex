// Frontend mirror of the backend API contracts
// (staynex-backend/types/api.ts). Hand-copied on purpose: the frontend must not
// import backend internals, so the dependency direction stays one-way.
// Keep this file in sync when the backend contract changes.

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

export interface PropertyReviewCheckView {
  id: string;
  key: string;
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

export interface MediaUploadTarget {
  key: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface AvailabilityDay {
  date: string;
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

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const PROPERTY_REVIEW_STATUS_LABELS: Record<PropertyReviewStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Reviewing",
  FAILED: "Needs changes",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
  MANUAL_REVIEW: "Manual review",
};

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

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  HOLD: "On hold",
  PENDING_PAYMENT: "Pending payment",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  INITIATED: "Initiated",
  PENDING: "Pending",
  SUCCESS: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

// --- Phase 4: dashboards, notifications, AI logs ---

export type PayoutStatusValue = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

export const PAYOUT_STATUS_LABELS: Record<PayoutStatusValue, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
};

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

export interface AdminBookingsView {
  bookings: BookingRow[];
  payments: AdminPaymentRow[];
}

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
  /** When the payout becomes eligible to settle (checkIn + 24h). */
  eligibleAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

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

// --- Phase 4: AI assistant ---

export interface AssistantReply {
  conversationId: string;
  reply: string;
  refused: boolean;
  unavailable: boolean;
  groundedFacts: string[];
}

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
}

// --- Phase 5: auth, testimonials, areas ---

export type AppRole = "GUEST" | "OWNER" | "ADMIN_REVIEWER" | "ADMIN_MANAGER";

/** Additive capabilities. GUEST is always present for a signed-in user. */
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

export function isAuthMfaChallenge(
  value: AuthResponse,
): value is AuthMfaChallenge {
  return "mfaRequired" in value && value.mfaRequired === true;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  GUEST: "Guest",
  OWNER: "Property owner",
  ADMIN_REVIEWER: "Admin",
  ADMIN_MANAGER: "Super Admin",
};

export function isOwnerCapable(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.capabilities.includes("OWNER"));
}

export function isAdminCapable(user: AuthUser | null | undefined): boolean {
  return Boolean(
    user?.capabilities.includes("ADMIN_REVIEWER") ||
    user?.capabilities.includes("ADMIN_MANAGER"),
  );
}

export function isAdminManager(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.capabilities.includes("ADMIN_MANAGER"));
}

/** Destination after auth, driven by capability (not just the compat role). */
export function capabilityHome(user: AuthUser): string {
  if (isAdminCapable(user)) return "/admin";
  if (isOwnerCapable(user)) return "/owner/dashboard";
  return "/stays";
}

// --- Owner v1: onboarding, locations, payout, settings ---

export type PayoutMethodStatusValue =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "DISABLED";

export const PAYOUT_METHOD_STATUS_LABELS: Record<
  PayoutMethodStatusValue,
  string
> = {
  PENDING_VERIFICATION: "Pending verification",
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

export interface OwnerProfileView {
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
  propertyCount: number;
  createdAt: string;
}

export interface OwnerPayoutMethodView {
  id: string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  provider: string | null;
  status: PayoutMethodStatusValue;
  hasEncryptedNumber: boolean;
  updatedAt: string;
}

export interface OwnerOnboardingState {
  profile: OwnerProfileView;
  locations: OwnerLocationView[];
  payoutMethod: OwnerPayoutMethodView | null;
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
  /** Populated only for Super Admins; null + `phoneRestricted` for reviewers. */
  phone: string | null;
  phoneRestricted: boolean;
  role: AppRole;
  capabilities: AppCapability[];
  createdAt: string;
  ownerProfile: OwnerProfileView | null;
  ownerLocations: OwnerLocationView[];
  payoutMethod: OwnerPayoutMethodView | null;
  payoutRestricted: boolean;
  counts: {
    properties: number;
    bookings: number;
  };
  payoutSummary: {
    paidKobo: number;
    pendingKobo: number;
    currency: string;
  };
}

export interface RevealedPayoutMethod {
  ownerId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  provider: string | null;
}

export interface CityOption {
  id: string;
  name: string;
  slug: string;
}

export type TestimonialStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export const TESTIMONIAL_STATUS_LABELS: Record<TestimonialStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

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

export interface BookingReviewContext {
  bookingId: string;
  propertyName: string;
  roomName: string;
  canReview: boolean;
  alreadyReviewed: boolean;
  reason: string | null;
}

export type AreaTypeValue = "LOCAL_GOVERNMENT_AREA" | "NEIGHBORHOOD";

export const AREA_TYPE_LABELS: Record<AreaTypeValue, string> = {
  LOCAL_GOVERNMENT_AREA: "LGA",
  NEIGHBORHOOD: "Neighborhood",
};

export interface AreaOption {
  id: string;
  name: string;
  slug: string;
  type: AreaTypeValue;
  notable: boolean;
  hasProperties: boolean;
}
