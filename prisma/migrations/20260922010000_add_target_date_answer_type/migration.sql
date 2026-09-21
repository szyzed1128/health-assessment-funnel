-- AlterEnum
ALTER TYPE "AssessmentAnswerType" ADD VALUE 'DATE';

-- Add user-selected target date while retaining the server-computed target date.
ALTER TABLE "HealthAssessmentResult" ADD COLUMN "requestedTargetDate" TIMESTAMP(3);
