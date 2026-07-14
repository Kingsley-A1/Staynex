-- Server-backed Staynex AI message feedback, safe response replacement, and
-- verified property-card snapshots.
CREATE TYPE "AIMessageFeedback" AS ENUM ('UP', 'DOWN');

ALTER TABLE "AIMessage"
  ADD COLUMN "feedback" "AIMessageFeedback",
  ADD COLUMN "feedbackAt" TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "propertyCards" JSONB;

CREATE INDEX "AIMessage_conversationId_supersededAt_createdAt_idx"
  ON "AIMessage"("conversationId", "supersededAt", "createdAt");
