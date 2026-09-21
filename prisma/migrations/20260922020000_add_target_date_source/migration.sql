-- Add explicit source and effective date for the forecast.
CREATE TYPE "TargetDateSource" AS ENUM ('SYSTEM', 'IMPORTANT_DATE');

ALTER TABLE "HealthAssessmentResult"
  ADD COLUMN "targetDateSource" "TargetDateSource" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "forecastTargetDate" TIMESTAMP(3);

UPDATE "HealthAssessmentResult"
SET "forecastTargetDate" = "targetDate"
WHERE "forecastTargetDate" IS NULL;
