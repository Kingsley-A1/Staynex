-- Provider-authoritative payout setup: retain the provider bank code on each
-- payout method and keep a durable Paystack bank-directory fallback.

ALTER TABLE "OwnerPayoutMethod" ADD COLUMN "bankCode" STRING;

CREATE TABLE "BankDirectoryEntry" (
    "id" STRING NOT NULL,
    "provider" STRING NOT NULL,
    "country" STRING NOT NULL,
    "currency" STRING NOT NULL,
    "code" STRING NOT NULL,
    "name" STRING NOT NULL,
    "type" STRING,
    "active" BOOL NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT current_timestamp(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDirectoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankDirectoryEntry_provider_country_code_key"
ON "BankDirectoryEntry"("provider", "country", "code");

CREATE INDEX "BankDirectoryEntry_provider_country_active_name_idx"
ON "BankDirectoryEntry"("provider", "country", "active", "name");
