-- Property auto-review: additive review state, review runs/checks, and delayed
-- publish scheduling. Public catalog remains gated by Property.status = APPROVED.

-- CreateEnum
CREATE TYPE "PropertyReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'FAILED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PropertyReviewSource" AS ENUM ('AUTO_REVIEW', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "PropertyReviewCheckStatus" AS ENUM ('PASS', 'FAIL', 'WARNING');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "contentVersion" INT4 NOT NULL DEFAULT 1;
ALTER TABLE "Property" ADD COLUMN "reviewStatus" "PropertyReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Property" ADD COLUMN "reviewSource" "PropertyReviewSource";
ALTER TABLE "Property" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN "scheduledPublishAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PropertyReviewRun" (
    "id" STRING NOT NULL,
    "propertyId" STRING NOT NULL,
    "contentVersion" INT4 NOT NULL,
    "source" "PropertyReviewSource" NOT NULL DEFAULT 'AUTO_REVIEW',
    "status" "PropertyReviewStatus" NOT NULL DEFAULT 'PENDING',
    "riskScore" INT4 NOT NULL DEFAULT 0,
    "summary" STRING,
    "scheduledPublishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyReviewCheck" (
    "id" STRING NOT NULL,
    "runId" STRING NOT NULL,
    "key" STRING NOT NULL,
    "label" STRING NOT NULL,
    "status" "PropertyReviewCheckStatus" NOT NULL,
    "severity" STRING NOT NULL,
    "details" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyReviewCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_reviewStatus_idx" ON "Property"("reviewStatus");

-- CreateIndex
CREATE INDEX "Property_scheduledPublishAt_idx" ON "Property"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "PropertyReviewRun_propertyId_idx" ON "PropertyReviewRun"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyReviewRun_status_idx" ON "PropertyReviewRun"("status");

-- CreateIndex
CREATE INDEX "PropertyReviewRun_scheduledPublishAt_idx" ON "PropertyReviewRun"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "PropertyReviewRun_propertyId_contentVersion_idx" ON "PropertyReviewRun"("propertyId", "contentVersion");

-- CreateIndex
CREATE INDEX "PropertyReviewCheck_runId_idx" ON "PropertyReviewCheck"("runId");

-- CreateIndex
CREATE INDEX "PropertyReviewCheck_status_idx" ON "PropertyReviewCheck"("status");

-- AddForeignKey
ALTER TABLE "PropertyReviewRun" ADD CONSTRAINT "PropertyReviewRun_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyReviewCheck" ADD CONSTRAINT "PropertyReviewCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PropertyReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
