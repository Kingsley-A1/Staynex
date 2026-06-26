-- Owner auth v1: additive user capabilities, owner onboarding data (locations +
-- payout method), and single-use password-reset tokens. Additive and safe;
-- existing role-based access is preserved and backfilled into capability grants.

-- CreateEnum
CREATE TYPE "AppCapability" AS ENUM ('OWNER', 'ADMIN_REVIEWER', 'ADMIN_MANAGER');

-- CreateEnum
CREATE TYPE "PayoutMethodStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED');

-- AlterTable: OwnerProfile — onboarding completion marker.
ALTER TABLE "OwnerProfile" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable: Property — optional link to the owner's saved location.
ALTER TABLE "Property" ADD COLUMN "ownerLocationId" STRING;

-- CreateTable
CREATE TABLE "UserCapability" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "capability" "AppCapability" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerLocation" (
    "id" STRING NOT NULL,
    "ownerId" STRING NOT NULL,
    "cityId" STRING NOT NULL,
    "areaId" STRING,
    "label" STRING,
    "addressLine" STRING,
    "isPrimary" BOOL NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerPayoutMethod" (
    "id" STRING NOT NULL,
    "ownerId" STRING NOT NULL,
    "bankName" STRING NOT NULL,
    "accountName" STRING NOT NULL,
    "accountNumberLast4" STRING NOT NULL,
    "accountNumberEnc" STRING,
    "provider" STRING,
    "status" "PayoutMethodStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerPayoutMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "tokenHash" STRING NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCapability_userId_idx" ON "UserCapability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCapability_userId_capability_key" ON "UserCapability"("userId", "capability");

-- CreateIndex
CREATE INDEX "OwnerLocation_ownerId_idx" ON "OwnerLocation"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerLocation_cityId_idx" ON "OwnerLocation"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayoutMethod_ownerId_key" ON "OwnerPayoutMethod"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Property_ownerLocationId_idx" ON "Property"("ownerLocationId");

-- AddForeignKey
ALTER TABLE "UserCapability" ADD CONSTRAINT "UserCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLocation" ADD CONSTRAINT "OwnerLocation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLocation" ADD CONSTRAINT "OwnerLocation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerLocation" ADD CONSTRAINT "OwnerLocation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayoutMethod" ADD CONSTRAINT "OwnerPayoutMethod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerLocationId_fkey" FOREIGN KEY ("ownerLocationId") REFERENCES "OwnerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill capability grants from existing roles so guards keep working after the
-- switch to capability-based checks. Guest capability is implicit (not stored).
INSERT INTO "UserCapability" ("id", "userId", "capability", "grantedAt")
SELECT gen_random_uuid()::STRING, "id", 'OWNER'::"AppCapability", current_timestamp()
FROM "User" WHERE "role" = 'OWNER';

INSERT INTO "UserCapability" ("id", "userId", "capability", "grantedAt")
SELECT gen_random_uuid()::STRING, "id", 'ADMIN_REVIEWER'::"AppCapability", current_timestamp()
FROM "User" WHERE "role" = 'ADMIN_REVIEWER';

INSERT INTO "UserCapability" ("id", "userId", "capability", "grantedAt")
SELECT gen_random_uuid()::STRING, "id", 'ADMIN_MANAGER'::"AppCapability", current_timestamp()
FROM "User" WHERE "role" = 'ADMIN_MANAGER';
