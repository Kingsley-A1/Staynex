// Human-readable labels for the backend status enums.
//
// The enum *unions* are imported (type-only) from the canonical contract so these
// maps stay exhaustive: if the backend adds a new status, `tsc` fails here until
// the label is added. There is no re-encoding of the unions themselves.

import type {
  BookingStatus,
  PaymentState,
  PayoutStatusValue,
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
  REFUNDED: "neutral",
};
