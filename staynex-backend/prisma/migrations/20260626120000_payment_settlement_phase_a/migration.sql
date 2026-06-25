-- Phase A payment settlement: explicit accounting on Payment + owner settlement
-- detail on Payout. Additive and safe; existing payments are backfilled.

-- AlterTable: Payment — explicit settlement accounting (kobo). `amount` is kept
-- as a compatibility mirror of `grossAmountKobo`.
ALTER TABLE "Payment" ADD COLUMN "grossAmountKobo" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "platformFeeKobo" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "ownerPayoutKobo" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "commissionRateBps" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill existing payments: treat the legacy `amount` as gross and apply the
-- default 10% (1000 bps) commission so net owner earnings are correct for history.
UPDATE "Payment"
SET "grossAmountKobo" = "amount",
    "commissionRateBps" = 1000,
    "platformFeeKobo" = round("amount"::FLOAT8 * 1000 / 10000)::INT4,
    "ownerPayoutKobo" = "amount" - round("amount"::FLOAT8 * 1000 / 10000)::INT4
WHERE "grossAmountKobo" = 0;
UPDATE "Payment" SET "paidAt" = "updatedAt" WHERE "status" = 'SUCCESS' AND "paidAt" IS NULL;

-- AlterTable: Payout — one owner settlement per successful payment. The required
-- columns use a transient default that is immediately dropped, so the migration is
-- safe whether or not the table holds rows (no app code wrote payouts pre-Phase-A).
ALTER TABLE "Payout" ADD COLUMN "bookingId" STRING NOT NULL DEFAULT '';
ALTER TABLE "Payout" ALTER COLUMN "bookingId" DROP DEFAULT;
ALTER TABLE "Payout" ADD COLUMN "paymentId" STRING NOT NULL DEFAULT '';
ALTER TABLE "Payout" ALTER COLUMN "paymentId" DROP DEFAULT;
ALTER TABLE "Payout" ADD COLUMN "ownerId" STRING NOT NULL DEFAULT '';
ALTER TABLE "Payout" ALTER COLUMN "ownerId" DROP DEFAULT;
ALTER TABLE "Payout" ADD COLUMN "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT current_timestamp();
ALTER TABLE "Payout" ALTER COLUMN "eligibleAt" DROP DEFAULT;
ALTER TABLE "Payout" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN "processedByUserId" STRING;

-- CreateIndex
CREATE UNIQUE INDEX "Payout_bookingId_key" ON "Payout"("bookingId");
CREATE UNIQUE INDEX "Payout_paymentId_key" ON "Payout"("paymentId");
CREATE INDEX "Payout_ownerId_idx" ON "Payout"("ownerId");
CREATE INDEX "Payout_eligibleAt_idx" ON "Payout"("eligibleAt");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
