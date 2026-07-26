import { Injectable } from "@nestjs/common";
import { PaystackService } from "./paystack.service";
import type {
  InitializeInput,
  InitializedTransaction,
  NormalizedEventKind,
  NormalizedStatus,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
  VerifiedTransaction,
} from "./payment-provider.port";

interface PaystackWebhookPayload {
  event?: string;
  data?: {
    reference?: string;
    /** Refund events reference the original transaction via this field. */
    transaction_reference?: string;
    id?: number | string;
    amount?: number;
    currency?: string;
  };
}

/**
 * Paystack behind the provider port. Deliberately a thin wrapper: all HTTP and
 * signature logic stays in `PaystackService` (unchanged and still directly
 * unit-tested), so introducing the port carries no behavioural risk.
 *
 * Paystack speaks kobo for NGN natively, so no unit conversion happens here.
 */
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name: ProviderName = "paystack";

  constructor(private readonly paystack: PaystackService) {}

  isConfigured(): boolean {
    return Boolean(process.env.PAYSTACK_SECRET_KEY);
  }

  async initializeTransaction(
    input: InitializeInput,
  ): Promise<InitializedTransaction> {
    const init = await this.paystack.initializeTransaction(input);
    return {
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      // Paystack's initialize echoes our reference and does not return a
      // separate transaction id; it appears later on verify.
      providerReference: null,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const verified = await this.paystack.verifyTransaction(reference);
    return {
      status: normalizeStatus(verified.status),
      reference: verified.reference,
      providerReference: null,
      amountKobo: verified.amountKobo, // already kobo
      currency: verified.currency,
    };
  }

  refundTransaction(reference: string): Promise<void> {
    return this.paystack.refundTransaction(reference);
  }

  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const header = headers["x-paystack-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    return this.paystack.verifySignature(rawBody, signature);
  }

  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent {
    const payload = JSON.parse(
      rawBody.toString("utf8"),
    ) as PaystackWebhookPayload;
    const rawType = payload.event ?? "";
    const data = payload.data ?? {};
    return {
      kind: normalizeEvent(rawType),
      reference: data.reference ?? data.transaction_reference ?? null,
      providerReference: data.id != null ? String(data.id) : null,
      amountKobo: typeof data.amount === "number" ? data.amount : null,
      currency: data.currency ?? null,
      rawType,
      payload,
    };
  }
}

/**
 * Paystack transaction status -> normalized. Anything unrecognized stays
 * "pending": an unknown status must never be read as a terminal failure, which
 * would release the guest's held capacity.
 */
function normalizeStatus(status: string): NormalizedStatus {
  switch (status) {
    case "success":
      return "success";
    case "failed":
    case "reversed":
      return "failed";
    case "abandoned":
      return "abandoned";
    default:
      return "pending";
  }
}

function normalizeEvent(event: string): NormalizedEventKind {
  switch (event) {
    case "charge.success":
      return "charge.success";
    case "charge.failed":
      return "charge.failed";
    case "refund.processed":
      return "refund.processed";
    default:
      return "other";
  }
}
