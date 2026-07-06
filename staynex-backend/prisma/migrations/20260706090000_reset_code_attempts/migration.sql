-- Password reset moves from an emailed link to a 6-digit code. Add an attempts
-- counter so a short, guessable code can't be brute-forced (capped like MFA).
-- Additive and safe on live data.

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN "attempts" INT4 NOT NULL DEFAULT 0;
