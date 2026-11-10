import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import { NotificationsService } from "../notifications/notifications.service";
import {
  PAYMENT_MODES,
  isProviderName,
  type PaymentMode,
  type ProviderName,
} from "./payment-provider.port";

/** Outcomes a money-touching action can resolve to. */
export type PaymentOutcome =
  | "CONFIRMED"
  | "REVIVED"
  | "REQUIRES_REFUND"
  | "UNDERPAID"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PROVIDER_MISMATCH"
  | "MODE_MISMATCH"
  | "REFERENCE_MISMATCH"
  | "PROVIDER_REFERENCE_MISMATCH"
  | "MARKED_FAILED"
  | "REFUNDED"
  | "DUPLICATE"
  | "UNKNOWN_REFERENCE"
  | "NO_CHANGE"
  | "RECORDED";

/** Outcomes that require operator visibility or follow-up. */
export const EXCEPTION_OUTCOMES: PaymentOutcome[] = [
  "REQUIRES_REFUND",
  "UNDERPAID",
  "AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  "PROVIDER_MISMATCH",
  "MODE_MISMATCH",
  "REFERENCE_MISMATCH",
  "PROVIDER_REFERENCE_MISMATCH",
];

export interface PaymentOutcomeResult {
  outcome: PaymentOutcome;
  detail?: string;
}

/**
 * Immutable money audit trail. Audit persistence fails closed: a provider
 * delivery is not acknowledged when its evidence cannot be stored, allowing
 * the provider to retry instead of making a financial transition invisible.
 */
@Injectable()
export class PaymentEventsService {
  private readonly logger = new Logger(PaymentEventsService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async record(entry: {
    eventType: string;
    reference: string | null;
    outcome: PaymentOutcome;
    provider: ProviderName;
    mode: PaymentMode;
    providerReference: string | null;
    detail?: string;
    payload?: unknown;
  }): Promise<void> {
    if (!isProviderName(entry.provider)) {
      throw new Error("Payment audit provider is missing or unsupported.");
    }
    if (!(PAYMENT_MODES as readonly string[]).includes(entry.mode)) {
      throw new Error("Payment audit mode is missing or unsupported.");
    }

    await prisma.paymentEvent.create({
      data: {
        eventType: entry.eventType,
        provider: entry.provider,
        mode: entry.mode,
        providerReference: entry.providerReference,
        reference: entry.reference,
        outcome: entry.outcome,
        detail: entry.detail ?? null,
        payload: minimizeAuditPayload(entry.payload),
      },
    });

    if (EXCEPTION_OUTCOMES.includes(entry.outcome)) {
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

function minimizeAuditPayload(
  payload: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Prisma.DbNull;
  }

  const source = payload as Record<string, unknown>;
  const minimized: Record<string, string | number | null> = {};
  for (const key of [
    "kind",
    "reference",
    "providerReference",
    "amountKobo",
    "currency",
  ]) {
    const value = source[key];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number"
    ) {
      minimized[key] = value;
    }
  }

  return Object.keys(minimized).length > 0
    ? (minimized as Prisma.InputJsonValue)
    : Prisma.DbNull;
}
