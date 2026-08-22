// Human-readable labels for the backend status enums.
//
// The enum *unions* are imported (type-only) from the canonical contract so these
// maps stay exhaustive: if the backend adds a new status, `tsc` fails here until
// the label is added. There is no re-encoding of the unions themselves.

import type {
  AppRole,
  AreaTypeValue,
  BookingStatus,
  PaymentState,
  PayoutMethodStatusValue,
  PayoutStatusValue,
  PropertyReviewStatus,
  PropertyStatus,
  TestimonialStatus,
} from "@staynex/backend/types";

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
  REQUIRES_REFUND: "Refund required",
  REFUNDED: "Refunded",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatusValue, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
};

/** Semantic tone for a status badge, mapped to brand colors by the client. */
export type StatusTone = "neutral" | "success" | "warning" | "error";

export const BOOKING_STATUS_TONE: Record<BookingStatus, StatusTone> = {
  HOLD: "warning",
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  CANCELLED: "neutral",
  EXPIRED: "error",
};

export const PAYMENT_STATE_TONE: Record<PaymentState, StatusTone> = {
  INITIATED: "neutral",
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "error",
  REQUIRES_REFUND: "error",
  REFUNDED: "neutral",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const PROPERTY_REVIEW_STATUS_LABELS: Record<
  PropertyReviewStatus,
  string
> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Reviewing",
  FAILED: "Needs changes",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
  MANUAL_REVIEW: "Manual review",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  GUEST: "Guest",
  OWNER: "Host",
  ADMIN_REVIEWER: "Admin",
  ADMIN_MANAGER: "Super Admin",
};

export const PAYOUT_METHOD_STATUS_LABELS: Record<
  PayoutMethodStatusValue,
  string
> = {
  PENDING_VERIFICATION: "Pending verification",
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

export const TESTIMONIAL_STATUS_LABELS: Record<TestimonialStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const AREA_TYPE_LABELS: Record<AreaTypeValue, string> = {
  LOCAL_GOVERNMENT_AREA: "LGA",
  NEIGHBORHOOD: "Neighborhood",
};
