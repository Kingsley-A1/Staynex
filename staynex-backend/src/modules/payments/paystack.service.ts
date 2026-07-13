import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
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

interface PaystackBanksResponse {
  status: boolean;
  message: string;
  data?: Array<{
    name: string;
    code: string;
    active?: boolean;
    is_deleted?: boolean;
    currency?: string;
    type?: string;
  }>;
  meta?: { next?: string | null };
}

interface PaystackResolveAccountResponse {
  status: boolean;
  message: string;
  data?: { account_number: string; account_name: string };
}

export interface PaystackBank {
  code: string;
  name: string;
  currency: string;
  type: string | null;
}

export interface ResolvedPaystackAccount {
  accountNumber: string;
  accountName: string;
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

    const json = (await res
      .json()
      .catch(() => null)) as PaystackInitResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      this.logger.error(
        `Paystack initialize failed: ${json?.message ?? res.status}`,
      );
      throw new ServiceUnavailableException("Payment initialization failed");
    }
    return {
      authorizationUrl: json.data.authorization_url,
      reference: json.data.reference,
    };
  }

  async verifyTransaction(
    reference: string,
  ): Promise<VerifiedPaystackTransaction> {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.secret()}` },
      },
    );

    const json = (await res
      .json()
      .catch(() => null)) as PaystackVerifyResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      this.logger.warn(
        `Paystack verify failed for ${reference}: ${json?.message ?? res.status}`,
      );
      throw new ServiceUnavailableException("Payment verification failed");
    }

    return {
      status: json.data.status,
      reference: json.data.reference,
      amountKobo: json.data.amount,
      currency: json.data.currency,
    };
  }

  /** Provider-authoritative Nigerian bank directory, cursor-paginated. */
  async listBanks(): Promise<PaystackBank[]> {
    try {
      const banks = new Map<string, PaystackBank>();
      let next: string | null = null;
      let page = 0;

      do {
        const query = new URLSearchParams({
          country: "nigeria",
          currency: "NGN",
          use_cursor: "true",
          perPage: "100",
        });
        if (next) query.set("next", next);
        const res = await fetch(
          `https://api.paystack.co/bank?${query.toString()}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${this.secret()}` },
          },
        );
        const json = (await res
          .json()
          .catch(() => null)) as PaystackBanksResponse | null;
        if (!res.ok || !json?.status || !json.data) {
          this.logger.warn(
            `Paystack bank directory failed: ${json?.message ?? res.status}`,
          );
          throw new ServiceUnavailableException(
            "Bank directory is temporarily unavailable",
          );
        }
        for (const bank of json.data) {
          if (
            !bank.code ||
            !bank.name ||
            bank.active === false ||
            bank.is_deleted === true
          )
            continue;
          banks.set(bank.code, {
            code: bank.code,
            name: bank.name,
            currency: bank.currency || "NGN",
            type: bank.type || null,
          });
        }
        next = json.meta?.next || null;
        page += 1;
      } while (next && page < 10);

      return [...banks.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(
        `Paystack bank directory unreachable: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      throw new ServiceUnavailableException(
        "Bank directory is temporarily unavailable",
      );
    }
  }

  /** Resolve the provider-registered account holder; never trusts client names. */
  async resolveBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedPaystackAccount> {
    const query = new URLSearchParams({
      account_number: accountNumber,
      bank_code: bankCode,
    });
    try {
      const res = await fetch(
        `https://api.paystack.co/bank/resolve?${query.toString()}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${this.secret()}` },
        },
      );
      const json = (await res
        .json()
        .catch(() => null)) as PaystackResolveAccountResponse | null;
      if (!res.ok || !json?.status || !json.data?.account_name) {
        this.logger.warn(
          `Paystack account resolution failed for bank ${bankCode}: ${json?.message ?? res.status}`,
        );
        if (res.status >= 400 && res.status < 500) {
          throw new BadRequestException(
            json?.message || "The bank could not verify this account number",
          );
        }
        throw new ServiceUnavailableException(
          "Account verification is temporarily unavailable",
        );
      }
      return {
        accountNumber: json.data.account_number,
        accountName: json.data.account_name.trim(),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.warn(
        `Paystack account resolution unreachable for bank ${bankCode}`,
      );
      throw new ServiceUnavailableException(
        "Account verification is temporarily unavailable",
      );
    }
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
    const expected = createHmac("sha512", this.secret())
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
