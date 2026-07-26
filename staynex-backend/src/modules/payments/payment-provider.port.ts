/**
 * The payment-provider port. Everything the booking loop needs from a payin
 * provider, and nothing provider-specific above this line.
 *
 * Three invariants this boundary exists to enforce (see `Opay-Integration.md`):
 *
 *  1. Operations on an EXISTING payment resolve their adapter from the persisted
 *     `Payment.provider` — never from a global default. Verifying an Opay
 *     payment against Paystack would report "not found", which the sync path
 *     treats as abandoned, which cancels the booking of a guest who actually
 *     paid.
 *  2. Only kobo (integer minor units) crosses this boundary. Adapters convert
 *     inward at the edge; core accounting never sees a provider's own units.
 *  3. Adapters normalize status and event vocabulary. Core never learns a
 *     provider's status strings or webhook event names.
 */

/** Providers the platform can charge through. */
export const PROVIDER_NAMES = ["paystack", "opay"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export function isProviderName(value: unknown): value is ProviderName {
  return (
    typeof value === "string" &&
    (PROVIDER_NAMES as readonly string[]).includes(value)
  );
}

export interface InitializeInput {
  email: string;
  /** Always kobo. Adapters convert to their provider's representation. */
  amountKobo: number;
  /** OUR reference (`stx_<uuid>`). Providers must adopt it, not replace it. */
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface InitializedTransaction {
  authorizationUrl: string;
  /** Our reference, echoed back for assertion. */
  reference: string;
  /** The provider's own transaction id, when it returns one. Reconciliation. */
  providerReference: string | null;
}

/**
 * Normalized transaction status. Adapters map their provider's vocabulary onto
 * these four values; anything unrecognized MUST map to "pending" so an unknown
 * status can never be mistaken for a terminal failure and release capacity.
 */
export type NormalizedStatus = "success" | "failed" | "abandoned" | "pending";

export interface VerifiedTransaction {
  status: NormalizedStatus;
  reference: string;
  providerReference: string | null;
  /** ALWAYS kobo. */
  amountKobo: number;
  currency: string;
}

/** Normalized webhook event. `other` is recorded but drives no transition. */
export type NormalizedEventKind =
  | "charge.success"
  | "charge.failed"
  | "refund.processed"
  | "other";

export interface NormalizedWebhookEvent {
  kind: NormalizedEventKind;
  /** Our reference, when the payload carries it. */
  reference: string | null;
  providerReference: string | null;
  /** Kobo, or null when the payload omits it (core then verifies). */
  amountKobo: number | null;
  currency: string | null;
  /** The provider's own event name, preserved for the audit trail. */
  rawType: string;
  /** The parsed payload, stored raw on the PaymentEvent row. */
  payload: unknown;
}

export class RefundNotSupportedError extends Error {
  constructor(provider: ProviderName, detail: string) {
    super(`${provider} cannot refund this transaction automatically: ${detail}`);
    this.name = "RefundNotSupportedError";
  }
}

export interface PaymentProvider {
  readonly name: ProviderName;

  /**
   * False when the provider's secrets are absent. The registry refuses to
   * register an unconfigured provider, so a half-configured deploy fails closed
   * (falls back to whatever IS configured) rather than erroring at checkout.
   */
  isConfigured(): boolean;

  initializeTransaction(
    input: InitializeInput,
  ): Promise<InitializedTransaction>;

  verifyTransaction(reference: string): Promise<VerifiedTransaction>;

  /**
   * Request a full refund. MUST throw unless the provider accepted it — a
   * silent no-op would let an admin believe money was returned when it was not.
   * Throws `RefundNotSupportedError` when the rail cannot be refunded via API,
   * so the admin surface can say "settle manually" instead of showing success.
   */
  refundTransaction(reference: string): Promise<void>;

  /** Verify webhook authenticity over the RAW body. */
  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean;

  /** Parse a signature-verified raw body into the normalized shape. */
  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent;
}
