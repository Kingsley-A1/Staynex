import { Badge } from "@/ui";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  type BookingStatus,
  type PaymentState,
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
  REFUNDED: "border-border bg-neutral-100 text-muted-foreground",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge className={BOOKING_STYLES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentState }) {
  return <Badge className={PAYMENT_STYLES[status]}>{PAYMENT_STATE_LABELS[status]}</Badge>;
}
