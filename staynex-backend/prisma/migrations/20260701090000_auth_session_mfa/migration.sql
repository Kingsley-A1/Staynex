-- Phase 3 security: admin-manager MFA challenges.
-- Session token hashing reuses the existing Session.token column and is upgraded
-- by application code on read, so no destructive session-table rewrite is needed.

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "codeHash" STRING NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INT4 NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaChallenge_userId_idx" ON "MfaChallenge"("userId");

-- CreateIndex
CREATE INDEX "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "MfaChallenge_usedAt_idx" ON "MfaChallenge"("usedAt");

-- AddForeignKey
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
