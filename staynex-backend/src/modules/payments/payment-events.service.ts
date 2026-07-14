import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Outcomes a money-touching action can resolve to. Everything lands in the
 * PaymentEvent audit trail; EXCEPTION_OUTCOMES additionally surface in the
 * admin exception queue.
 */
export type PaymentOutcome =
  | "CONFIRMED" // normal PENDING_PAYMENT -> CONFIRMED
  | "REVIVED" // late success; capacity still free, booking re-confirmed
  | "REQUIRES_REFUND" // money captured, booking cannot be honored
  | "UNDERPAID" // captured less than owed — needs refund + never confirms
  | "CURRENCY_MISMATCH" // captured in the wrong currency — needs human review
  | "MARKED_FAILED" // charge failed / abandoned; capacity released
  | "REFUNDED" // refund applied (admin- or provider-initiated)
  | "DUPLICATE" // already in a terminal state; delivery ignored
  | "UNKNOWN_REFERENCE" // no payment row for this reference
  | "NO_CHANGE" // nothing to do (e.g. still pending on verify)
  | "RECORDED"; // informational event stored without state change

/** Outcomes that indicate funds moved but the platform owes a human action. */
export const EXCEPTION_OUTCOMES: PaymentOutcome[] = [
  "REQUIRES_REFUND",
  "UNDERPAID",
  "CURRENCY_MISMATCH",
];

export interface PaymentOutcomeResult {
  outcome: PaymentOutcome;
  detail?: string;
}

/**
 * Immutable money audit trail. One row per provider webhook delivery, per
 * state-changing provider verification, and per admin money action. Recording
 * is best-effort by design: an audit-write failure is loudly logged but never
 * rolls back a verified financial state change.
 */
@Injectable()
export class PaymentEventsService {
  private readonly logger = new Logger(PaymentEventsService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async record(entry: {
    eventType: string;
    reference: string | null;
    outcome: PaymentOutcome;
    detail?: string;
    payload?: unknown;
  }): Promise<void> {
    try {
      await prisma.paymentEvent.create({
        data: {
          eventType: entry.eventType,
          reference: entry.reference,
          outcome: entry.outcome,
          detail: entry.detail ?? null,
          payload:
            entry.payload === undefined
              ? Prisma.DbNull
              : (entry.payload as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      this.logger.error(
        `PaymentEvent write failed (${entry.eventType} ${entry.reference ?? "-"} -> ${entry.outcome}): ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    }
    if (EXCEPTION_OUTCOMES.includes(entry.outcome)) {
      // Exceptions must be impossible to miss: ops log + every admin's inbox
      // and devices (deduped per reference, so retries never spam).
      this.logger.error(
        `PAYMENT EXCEPTION [${entry.outcome}] ref=${entry.reference ?? "-"} via ${entry.eventType}: ${entry.detail ?? ""}`,
      );
      await this.notifications.onPaymentException(
        entry.reference,
        entry.detail ?? entry.outcome,
      );
    }
  }
}
