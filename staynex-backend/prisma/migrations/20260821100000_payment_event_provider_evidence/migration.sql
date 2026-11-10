-- Bind immutable payment audit evidence to the provider environment and the
-- provider's transaction id. Historical events predate live charging and are
-- therefore conservatively classified TEST; no payload or event row is lost.

ALTER TABLE "PaymentEvent" ADD COLUMN "mode" "PaymentMode" NOT NULL DEFAULT 'TEST';
ALTER TABLE "PaymentEvent" ADD COLUMN "providerReference" STRING;

CREATE INDEX "PaymentEvent_provider_mode_reference_idx"
ON "PaymentEvent"("provider", "mode", "reference");
