// Platform commission accounting. Commission is expressed in basis points (bps):
// 1 bps = 0.01%, so 1000 bps = 10%. The single source of this math lives here so
// checkout, reporting, and tests never re-derive the split inconsistently.

/** Staynex default commission: 10%. Overridable via PLATFORM_COMMISSION_BPS. */
export const DEFAULT_COMMISSION_BPS = 1000;

export interface PaymentSplit {
  /** Full amount charged to the guest (kobo). */
  grossAmountKobo: number;
  /** Staynex commission retained from gross (kobo). */
  platformFeeKobo: number;
  /** Net amount owed to the owner (kobo) = gross - fee. */
  ownerPayoutKobo: number;
  /** The bps rate used for this split (clamped to [0, 10000]). */
  commissionRateBps: number;
}

function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return DEFAULT_COMMISSION_BPS;
  return Math.min(10000, Math.max(0, Math.round(bps)));
}

/**
 * Resolve the active commission rate (bps) from the environment, clamped to a
 * sane range. Boot-time validation lives in `config/env.ts`; this stays
 * defensive so a bad value can never produce a negative/over-100% split.
 */
export function resolveCommissionBps(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PLATFORM_COMMISSION_BPS;
  if (raw == null || raw === "") return DEFAULT_COMMISSION_BPS;
  const n = Number(raw);
  return Number.isFinite(n) ? clampBps(n) : DEFAULT_COMMISSION_BPS;
}

/**
 * Split a gross amount (kobo) into platform fee + owner payout using bps.
 * The fee rounds to the nearest kobo and the owner receives the remainder, so
 * `platformFeeKobo + ownerPayoutKobo === grossAmountKobo` exactly — no rounding
 * leak in either direction.
 */
export function splitPayment(grossAmountKobo: number, commissionRateBps: number): PaymentSplit {
  const bps = clampBps(commissionRateBps);
  const gross = Math.max(0, Math.round(grossAmountKobo));
  const platformFeeKobo = Math.round((gross * bps) / 10000);
  return {
    grossAmountKobo: gross,
    platformFeeKobo,
    ownerPayoutKobo: gross - platformFeeKobo,
    commissionRateBps: bps,
  };
}
