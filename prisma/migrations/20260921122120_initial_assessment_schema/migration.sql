-- CreateEnum
CREATE TYPE "AssessmentSessionStatus" AS ENUM ('IN_PROGRESS', 'READY_FOR_ASSESSMENT', 'ASSESSED');

-- CreateEnum
CREATE TYPE "AssessmentAnswerType" AS ENUM ('SINGLE_SELECT', 'NUMBER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" UUID NOT NULL,
    "status" "AssessmentSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionKey" VARCHAR(64) NOT NULL,
    "answerType" "AssessmentAnswerType" NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthAssessmentResult" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "bmi" DECIMAL(5,2),
    "recommendedDailyCalories" INTEGER,
    "targetDate" TIMESTAMP(3),
    "weeklyForecast" JSONB,
    "actionPlan" JSONB,
    "algorithmVersion" VARCHAR(32) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthAssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "paymentEventId" VARCHAR(128) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentSession_status_updatedAt_idx" ON "AssessmentSession"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AssessmentAnswer_sessionId_updatedAt_idx" ON "AssessmentAnswer"("sessionId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_sessionId_questionKey_key" ON "AssessmentAnswer"("sessionId", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "HealthAssessmentResult_sessionId_key" ON "HealthAssessmentResult"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_sessionId_key" ON "Subscription"("sessionId");

-- CreateIndex
CREATE INDEX "Subscription_status_endsAt_idx" ON "Subscription"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_paymentEventId_key" ON "PaymentEvent"("paymentEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_sessionId_createdAt_idx" ON "PaymentEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthAssessmentResult" ADD CONSTRAINT "HealthAssessmentResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
