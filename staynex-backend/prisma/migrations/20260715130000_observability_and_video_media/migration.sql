CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "PropertyMedia"
ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "RoomMedia"
ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE';

CREATE TABLE "WebVitalMetric" (
  "id" STRING NOT NULL,
  "metricId" STRING NOT NULL,
  "name" STRING NOT NULL,
  "value" FLOAT8 NOT NULL,
  "rating" STRING,
  "navigationType" STRING,
  "route" STRING NOT NULL,
  "target" FLOAT8,
  "targetMet" BOOL,
  "userAgent" STRING,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebVitalMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebVitalMetric_createdAt_idx" ON "WebVitalMetric"("createdAt");
CREATE INDEX "WebVitalMetric_name_createdAt_idx" ON "WebVitalMetric"("name", "createdAt");
CREATE INDEX "WebVitalMetric_route_createdAt_idx" ON "WebVitalMetric"("route", "createdAt");
