import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { OpayProvider } from "./opay.provider";
import { PaystackProvider } from "./paystack.provider";
import {
  isProviderName,
  type PaymentProvider,
  type ProviderName,
} from "./payment-provider.port";
import { PaymentConfigService } from "./payment-config.service";

/**
 * Resolves which adapter handles a given payment.
 *
 * The safety-critical rule: `get()` NEVER falls back. Operations on an existing
 * payment (verify, refund, webhook) pass the provider persisted on the row, and
 * if that provider is unknown or unconfigured this throws rather than quietly
 * using the default. A silent fallback would ask Paystack about an Opay
 * reference, get "not found", and let `syncPaymentStatus` cancel a booking the
 * guest genuinely paid for.
 *
 * `default()` is only legal when CREATING a new payment.
 */
@Injectable()
export class PaymentProviderRegistry {
  constructor(
    private readonly paystack: PaystackProvider,
    private readonly opay: OpayProvider,
    private readonly paymentConfig: PaymentConfigService = new PaymentConfigService(),
  ) {}

  private all(): PaymentProvider[] {
    return [this.paystack, this.opay];
  }

  /** Providers whose secrets are present — the only ones we may charge through. */
  configured(): PaymentProvider[] {
    return this.all().filter((provider) => provider.isConfigured());
  }

  isEnabled(name: ProviderName): boolean {
    return this.configured().some((provider) => provider.name === name);
  }

  /**
   * Resolve the adapter for an EXISTING payment. Throws on unknown or
   * unconfigured — see the class note. Never falls back to the default.
   */
  get(provider: string | null | undefined): PaymentProvider {
    if (!isProviderName(provider)) {
      throw new ServiceUnavailableException(
        `Unknown payment provider '${provider ?? "null"}' — refusing to guess. ` +
          `Resolve this payment manually rather than risk verifying it against the wrong provider.`,
      );
    }
    const match = this.all().find((candidate) => candidate.name === provider);
    if (!match || !match.isConfigured()) {
      throw new ServiceUnavailableException(
        `Payment provider '${provider}' is not configured on this deployment — ` +
          `cannot act on payments that were created through it.`,
      );
    }
    return match;
  }

  /**
   * The provider a NEW payment should use. The configured default is explicit;
   * a missing default fails closed instead of charging through another rail.
   */
  default(): PaymentProvider {
    const configured = this.configured();
    if (configured.length === 0) {
      throw new ServiceUnavailableException(
        "No payment provider is configured — checkout is unavailable.",
      );
    }

    const preferred = this.paymentConfig.current().defaultProvider;
    const match = configured.find((provider) => provider.name === preferred);
    if (!match) {
      throw new ServiceUnavailableException(
        `Default payment provider '${preferred}' is not configured for ${this.paymentConfig.current().mode.toLowerCase()} payments.`,
      );
    }
    // Paystack first when present — the incumbent stays the default until a
    // rollout policy explicitly says otherwise.
    return match;
  }

  /**
   * Pick a provider for a new payment, honoring the Opay rollout percentage.
   * Deterministic per reference so retries of the same checkout are stable.
   */
  selectForCheckout(reference: string): PaymentProvider {
    const fallback = this.default();
    const rollout = this.paymentConfig.current().opayRolloutPercent;
    if (rollout <= 0 || !this.isEnabled("opay")) return fallback;
    if (rollout >= 100) return this.get("opay");
    return bucketOf(reference) < rollout ? this.get("opay") : fallback;
  }
}

/** `PAYMENT_OPAY_ROLLOUT_PERCENT`, clamped to [0, 100]. Default 0 (off). */
/** Stable 0–99 bucket derived from the reference (FNV-1a). */
function bucketOf(reference: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < reference.length; i += 1) {
    hash ^= reference.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}
