-- Provider identity and environment for provider-agnostic payins.
-- Existing checkout was explicitly operating in no-charge test mode, so
-- historical rows are conservatively classified TEST. This migration is
-- additive and preserves every payment and audit record.

CREATE TYPE "PaymentMode" AS ENUM ('TEST', 'LIVE');

ALTER TABLE "Payment" ADD COLUMN "providerReference" STRING;
ALTER TABLE "Payment" ADD COLUMN "mode" "PaymentMode" NOT NULL DEFAULT 'TEST';

UPDATE "Payment" SET "provider" = 'paystack' WHERE "provider" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "provider" SET DEFAULT 'paystack';
ALTER TABLE "Payment" ALTER COLUMN "provider" SET NOT NULL;

CREATE INDEX "Payment_provider_mode_status_idx"
ON "Payment"("provider", "mode", "status");
