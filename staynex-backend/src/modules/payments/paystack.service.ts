import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
  };
}

export interface VerifiedPaystackTransaction {
  status: string;
  reference: string;
  amountKobo: number;
  currency: string;
}

/**
 * Thin Paystack integration: initialize a transaction and verify webhook
 * signatures. Pure integration — it owns no booking state. Reads secrets from
 * env at call time so the API still boots without Paystack configured.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  private secret(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        "Paystack is not configured (PAYSTACK_SECRET_KEY missing)",
      );
    }
    return key;
  }

  private callbackUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/payment/status`;
  }

  async initializeTransaction(
    input: InitializeInput,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo, // Paystack expects kobo for NGN
        reference: input.reference,
        currency: "NGN",
        callback_url: this.callbackUrl(),
        metadata: input.metadata,
      }),
    });

    const json = (await res.json().catch(() => null)) as PaystackInitResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      this.logger.error(`Paystack initialize failed: ${json?.message ?? res.status}`);
      throw new ServiceUnavailableException("Payment initialization failed");
    }
    return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifiedPaystackTransaction> {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.secret()}` },
      },
    );

    const json = (await res.json().catch(() => null)) as PaystackVerifyResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      this.logger.warn(`Paystack verify failed for ${reference}: ${json?.message ?? res.status}`);
      throw new ServiceUnavailableException("Payment verification failed");
    }

    return {
      status: json.data.status,
      reference: json.data.reference,
      amountKobo: json.data.amount,
      currency: json.data.currency,
    };
  }

  /**
   * Request a full refund of a transaction. Paystack processes refunds
   * asynchronously — an accepted request means "refund initiated", and the
   * terminal `refund.processed` webhook follows. Throws on rejection so the
   * caller never records a refund that was not accepted.
   */
  async refundTransaction(reference: string): Promise<void> {
    const res = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: reference }),
    });

    const json = (await res.json().catch(() => null)) as {
      status: boolean;
      message: string;
    } | null;
    if (!res.ok || !json?.status) {
      this.logger.error(
        `Paystack refund failed for ${reference}: ${json?.message ?? res.status}`,
      );
      throw new ServiceUnavailableException(
        `Refund was not accepted by the payment provider${json?.message ? ` — ${json.message}` : ""}`,
      );
    }
    this.logger.log(`Paystack refund initiated for ${reference}.`);
  }

  /** Verify the `x-paystack-signature` HMAC-SHA512 over the raw request body. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac("sha512", this.secret()).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
