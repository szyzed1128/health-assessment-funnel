import { PrismaAssessmentRepository } from "@/infrastructure/db/repositories/prisma-assessment-repository";
import { PrismaHealthRepository } from "@/infrastructure/db/repositories/prisma-health-repository";
import { PrismaPaymentRepository } from "@/infrastructure/db/repositories/prisma-payment-repository";
import { PrismaSessionRepository } from "@/infrastructure/db/repositories/prisma-session-repository";
import { PrismaSubscriptionRepository } from "@/infrastructure/db/repositories/prisma-subscription-repository";
import { createAssessmentService } from "@/modules/assessment/assessment-service";
import { createHealthService } from "@/modules/health/health-service";
import { createPaymentService } from "@/modules/payment/payment-service";
import { createSessionService } from "@/modules/session/session-service";
import { createSubscriptionService } from "@/modules/subscription/subscription-service";

export const sessionService = createSessionService(new PrismaSessionRepository());
export const assessmentService = createAssessmentService(new PrismaAssessmentRepository());
export const healthService = createHealthService(new PrismaHealthRepository());
export const subscriptionService = createSubscriptionService(new PrismaSubscriptionRepository());
export const paymentService = createPaymentService(
  new PrismaPaymentRepository(),
  subscriptionService.getVisibleResult,
);
