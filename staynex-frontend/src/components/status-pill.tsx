import { Badge } from "@/ui";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PAYOUT_STATUS_LABELS,
  type BookingStatus,
  type PaymentState,
  type PayoutStatusValue,
} from "@/lib/types";

const BOOKING_STYLES: Record<BookingStatus, string> = {
  HOLD: "border-border bg-secondary text-secondary-foreground",
  PENDING_PAYMENT: "border-warning-border bg-warning-surface text-warning",
  CONFIRMED: "border-success-border bg-success-surface text-success",
  CANCELLED: "border-border bg-neutral-100 text-muted-foreground",
  EXPIRED: "border-border bg-neutral-100 text-muted-foreground",
};

const PAYMENT_STYLES: Record<PaymentState, string> = {
  INITIATED: "border-border bg-secondary text-secondary-foreground",
  PENDING: "border-warning-border bg-warning-surface text-warning",
  SUCCESS: "border-success-border bg-success-surface text-success",
  FAILED: "border-error-border bg-error-surface text-error",
  REQUIRES_REFUND: "border-error-border bg-error-surface font-semibold text-error",
  REFUNDED: "border-border bg-neutral-100 text-muted-foreground",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge className={BOOKING_STYLES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentState }) {
  return <Badge className={PAYMENT_STYLES[status]}>{PAYMENT_STATE_LABELS[status]}</Badge>;
}

const PAYOUT_STYLES: Record<PayoutStatusValue, string> = {
  PENDING: "border-warning-border bg-warning-surface text-warning",
  PROCESSING: "border-border bg-secondary text-secondary-foreground",
  PAID: "border-success-border bg-success-surface text-success",
  FAILED: "border-error-border bg-error-surface text-error",
};

export function PayoutStatusBadge({ status }: { status: PayoutStatusValue | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <Badge className={PAYOUT_STYLES[status]}>{PAYOUT_STATUS_LABELS[status]}</Badge>;
}
