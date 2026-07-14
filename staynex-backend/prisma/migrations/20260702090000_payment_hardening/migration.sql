-- Payment hardening (payment-review P1–P11): immutable money audit trail,
-- refund-required state, hold price snapshots, provider-verify debounce, and
-- payout settlement notes. Additive and safe on live data.

-- AlterEnum: a captured payment the platform cannot honor must be visible,
-- never silently FAILED (P1/P4/P5).
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REFUND';

-- AlterTable: BookingHold — price snapshot at hold creation, so checkout
-- charges what the guest was quoted (P2). 0 marks legacy pre-snapshot rows.
ALTER TABLE "BookingHold" ADD COLUMN "nightlyPriceKobo" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "BookingHold" ADD COLUMN "totalKobo" INT4 NOT NULL DEFAULT 0;

-- AlterTable: Payment — debounce marker for provider verification polling (P8).
ALTER TABLE "Payment" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

-- AlterTable: Payout — settlement reference / failure reason + failure marker (P11).
ALTER TABLE "Payout" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN "note" STRING;

-- CreateTable: PaymentEvent — one row per webhook delivery, state-changing
-- provider verification, and admin money action, with the processing outcome.
CREATE TABLE "PaymentEvent" (
    "id" STRING NOT NULL,
    "provider" STRING NOT NULL DEFAULT 'paystack',
    "eventType" STRING NOT NULL,
    "reference" STRING,
    "outcome" STRING NOT NULL,
    "detail" STRING,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT current_timestamp(),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEvent_reference_idx" ON "PaymentEvent"("reference");
CREATE INDEX "PaymentEvent_outcome_idx" ON "PaymentEvent"("outcome");
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");
