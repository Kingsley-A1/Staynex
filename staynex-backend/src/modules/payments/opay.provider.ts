import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
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

/**
 * Opay (Cashier) behind the provider port.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠  WIRE CONTRACT NOT YET VERIFIED AGAINST A LIVE SANDBOX.
 *
 * This adapter is written to Opay's documented Cashier API shape, but every
 * provider-specific fact below is isolated in `CONTRACT` and MUST be confirmed
 * against Opay's current merchant docs + a real sandbox transaction before
 * `OPAY_ENABLED` is ever turned on. See `Opay-Integration.md` §"Remaining work"
 * for the exact checklist.
 *
 * The adapter is inert until BOTH `OPAY_ENABLED=true` AND the credentials are
 * present, so shipping it cannot affect production checkout.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Unit handling: Staynex is kobo-integer end to end. Opay's Cashier `amount`
 * is documented as `{ currency, total }` with `total` in minor units — i.e. the
 * same unit we already use. `toProviderAmount`/`fromProviderAmount` are kept as
 * explicit pure functions anyway: if verification shows Opay wants decimal
 * naira, exactly one function changes and the property test catches a 100x slip.
 */

/** Every provider-specific fact, in one place, for verification. */
const CONTRACT = {
  /** VERIFY: sandbox vs live base URL. */
  liveBaseUrl: "https://liveapi.opaycheckout.com",
  testBaseUrl: "https://testapi.opaycheckout.com",
  /** VERIFY: path + version for creating a hosted checkout. */
  createPath: "/api/v1/international/cashier/create",
  /** VERIFY: path for querying a transaction's status. */
  statusPath: "/api/v1/international/cashier/status",
  /** VERIFY: refund path, and whether refunds are sync or async. */
  refundPath: "/api/v1/international/cashier/refund",
  /** VERIFY: header carrying the webhook signature. */
  signatureHeader: "authorization",
  /** VERIFY: amount minor-unit exponent (2 = kobo per naira). */
  minorUnitExponent: 2,
  /** VERIFY: success/failure status vocabulary. */
  successStatuses: ["SUCCESS", "SUCCESSFUL"],
  failedStatuses: ["FAIL", "FAILED", "CLOSE", "ERROR"],
  pendingStatuses: ["INITIAL", "PENDING", "PROCESSING"],
} as const;

interface OpayEnvelope<T> {
  code?: string;
  message?: string;
  data?: T;
}

interface OpayCreateData {
  reference?: string;
  orderNo?: string;
  cashierUrl?: string;
}

interface OpayStatusData {
  reference?: string;
  orderNo?: string;
  status?: string;
  amount?: { currency?: string; total?: number };
}

/** Opay signals success with code "00000". VERIFY against docs. */
const OK_CODE = "00000";

@Injectable()
export class OpayProvider implements PaymentProvider {
  readonly name: ProviderName = "opay";
  private readonly logger = new Logger(OpayProvider.name);

  /**
   * Inert unless explicitly enabled AND fully credentialed. A half-configured
   * deploy therefore falls back to Paystack rather than failing at checkout.
   */
  isConfigured(): boolean {
    return (
      process.env.OPAY_ENABLED === "true" &&
      Boolean(process.env.OPAY_MERCHANT_ID) &&
      Boolean(process.env.OPAY_PUBLIC_KEY) &&
      Boolean(process.env.OPAY_SECRET_KEY)
    );
  }

  private secret(): string {
    const key = process.env.OPAY_SECRET_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        "Opay is not configured (OPAY_SECRET_KEY missing)",
      );
    }
    return key;
  }

  private merchantId(): string {
    const id = process.env.OPAY_MERCHANT_ID;
    if (!id) {
      throw new ServiceUnavailableException(
        "Opay is not configured (OPAY_MERCHANT_ID missing)",
      );
    }
    return id;
  }

  private baseUrl(): string {
    const override = process.env.OPAY_BASE_URL?.trim().replace(/\/+$/, "");
    if (override) return override;
    return process.env.NODE_ENV === "production"
      ? CONTRACT.liveBaseUrl
      : CONTRACT.testBaseUrl;
  }

  private callbackUrl(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/payment/status`;
  }

  /** Opay authenticates requests with an HMAC-SHA512 signature over the body. */
  private authHeaders(body: string): Record<string, string> {
    const signature = createHmac("sha512", this.secret())
      .update(body)
      .digest("hex");
    return {
      Authorization: `Bearer ${signature}`,
      MerchantId: this.merchantId(),
      "Content-Type": "application/json",
    };
  }

  async initializeTransaction(
    input: InitializeInput,
  ): Promise<InitializedTransaction> {
    const body = JSON.stringify({
      country: "NG",
      reference: input.reference, // our reference, not theirs
      amount: {
        currency: "NGN",
        total: toProviderAmount(input.amountKobo),
      },
      returnUrl: this.callbackUrl(),
      callbackUrl: this.callbackUrl(),
      expireAt: 30,
      userInfo: { userEmail: input.email },
      product: {
        name: "Staynex booking",
        description: "Accommodation booking on Staynex",
      },
      payMethod: "",
    });

    const res = await fetch(`${this.baseUrl()}${CONTRACT.createPath}`, {
      method: "POST",
      headers: this.authHeaders(body),
      body,
    });
    const json = (await res
      .json()
      .catch(() => null)) as OpayEnvelope<OpayCreateData> | null;

    if (!res.ok || json?.code !== OK_CODE || !json.data?.cashierUrl) {
      this.logger.error(
        `Opay initialize failed for ${input.reference}: ${json?.message ?? res.status}`,
      );
      throw new ServiceUnavailableException("Payment initialization failed");
    }

    return {
      authorizationUrl: json.data.cashierUrl,
      reference: input.reference,
      providerReference: json.data.orderNo ?? null,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const body = JSON.stringify({
      country: "NG",
      reference,
    });
    const res = await fetch(`${this.baseUrl()}${CONTRACT.statusPath}`, {
      method: "POST",
      headers: this.authHeaders(body),
      body,
    });
    const json = (await res
      .json()
      .catch(() => null)) as OpayEnvelope<OpayStatusData> | null;

    if (!res.ok || json?.code !== OK_CODE || !json.data) {
      this.logger.warn(
        `Opay verify failed for ${reference}: ${json?.message ?? res.status}`,
      );
      throw new ServiceUnavailableException("Payment verification failed");
    }

    const total = json.data.amount?.total;
    if (typeof total !== "number" || !Number.isFinite(total)) {
      // Never invent an amount: core would compare it against what is owed.
      throw new ServiceUnavailableException(
        "Payment verification returned no usable amount",
      );
    }

    return {
      status: normalizeStatus(json.data.status ?? ""),
      reference: json.data.reference ?? reference,
      providerReference: json.data.orderNo ?? null,
      amountKobo: fromProviderAmount(total),
      currency: json.data.amount?.currency ?? "NGN",
    };
  }

  async refundTransaction(reference: string): Promise<void> {
    const body = JSON.stringify({ country: "NG", reference });
    const res = await fetch(`${this.baseUrl()}${CONTRACT.refundPath}`, {
      method: "POST",
      headers: this.authHeaders(body),
      body,
    });
    const json = (await res.json().catch(() => null)) as OpayEnvelope<
      Record<string, unknown>
    > | null;

    if (!res.ok || json?.code !== OK_CODE) {
      this.logger.error(
        `Opay refund failed for ${reference}: ${json?.message ?? res.status}`,
      );
      // Throwing keeps the provider-first ordering: nothing changes locally
      // unless the provider actually accepted the refund.
      throw new ServiceUnavailableException(
        `Refund was not accepted by the payment provider${json?.message ? ` — ${json.message}` : ""}`,
      );
    }
    this.logger.log(`Opay refund initiated for ${reference}.`);
  }

  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const header = headers[CONTRACT.signatureHeader];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) return false;
    const provided = raw.replace(/^Bearer\s+/i, "").trim();
    if (!provided) return false;

    const expected = createHmac("sha512", this.secret())
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent {
    const payload = JSON.parse(rawBody.toString("utf8")) as {
      payload?: OpayStatusData & { transactionId?: string };
    };
    const data = payload.payload ?? {};
    const rawStatus = data.status ?? "";
    const total = data.amount?.total;

    return {
      kind: normalizeEvent(rawStatus),
      reference: data.reference ?? null,
      providerReference: data.orderNo ?? data.transactionId ?? null,
      amountKobo:
        typeof total === "number" && Number.isFinite(total)
          ? fromProviderAmount(total)
          : null,
      currency: data.amount?.currency ?? null,
      rawType: rawStatus,
      payload,
    };
  }
}

// --- unit conversion (isolated on purpose — see the file header) ------------

const FACTOR = 10 ** (CONTRACT.minorUnitExponent - 2);

/**
 * Kobo -> Opay's amount unit. Identity while Opay uses minor units (exponent 2).
 * Throws rather than silently rounding: a fractional result would mean our
 * assumption about the provider's unit is wrong, and a wrong amount is money.
 */
export function toProviderAmount(amountKobo: number): number {
  if (!Number.isInteger(amountKobo) || amountKobo < 0) {
    throw new Error(`Refusing to send a non-integer kobo amount: ${amountKobo}`);
  }
  const value = amountKobo / FACTOR;
  if (!Number.isInteger(value)) {
    throw new Error(
      `Kobo amount ${amountKobo} does not convert exactly to the provider unit`,
    );
  }
  return value;
}

/** Opay's amount unit -> kobo. Inverse of `toProviderAmount`. */
export function fromProviderAmount(amount: number): number {
  const kobo = amount * FACTOR;
  if (!Number.isInteger(kobo)) {
    throw new Error(
      `Provider amount ${amount} does not convert exactly to kobo`,
    );
  }
  return kobo;
}

function normalizeStatus(status: string): NormalizedStatus {
  const value = status.toUpperCase();
  if ((CONTRACT.successStatuses as readonly string[]).includes(value))
    return "success";
  if ((CONTRACT.failedStatuses as readonly string[]).includes(value))
    return "failed";
  // Unknown statuses stay pending — never terminal, so capacity is never
  // released on a status we do not understand.
  return "pending";
}

/**
 * Opay's webhook carries a transaction status rather than a Paystack-style
 * event name, so the status IS the event.
 */
function normalizeEvent(status: string): NormalizedEventKind {
  const normalized = normalizeStatus(status);
  if (normalized === "success") return "charge.success";
  if (normalized === "failed") return "charge.failed";
  return "other";
}
