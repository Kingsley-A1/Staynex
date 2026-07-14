-- Notifications v1: typed notifications with deep links, read state, an
-- idempotency key, an outbox payload for retries, and FCM device tokens.
-- Additive and safe on live data.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_REFUNDED', 'PAYOUT_PAID', 'PAYOUT_FAILED', 'PAYMENT_EXCEPTION', 'PROPERTY_REVIEW', 'CHECKIN_REMINDER', 'GENERAL');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- AlterTable: Notification — typed, linkable, readable, dedupable, retryable.
ALTER TABLE "Notification" ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Notification" ADD COLUMN "linkUrl" STRING;
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" STRING;
ALTER TABLE "Notification" ADD COLUMN "attempts" INT4 NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "payload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "token" STRING NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'WEB',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT current_timestamp(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT current_timestamp(),

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
