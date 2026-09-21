import { prisma } from "@/infrastructure/db/prisma";
import type { PaymentOutcome, PaymentRepository } from "@/modules/payment/payment-repository";

const subscriptionDurationDays = 30;

export class PrismaPaymentRepository implements PaymentRepository {
  async processSuccessfulPayment(sessionId: string, paymentEventId: string, processedAt: Date): Promise<PaymentOutcome> {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentEventId}))`;
      const existing = await transaction.paymentEvent.findUnique({ where: { paymentEventId } });
      if (existing !== null) return existing.sessionId === sessionId ? "SUCCEEDED" : "EVENT_CONFLICT";

      const session = await transaction.assessmentSession.findUnique({
        where: { id: sessionId }, include: { healthResult: true, subscription: true },
      });
      if (session === null) return "SESSION_NOT_FOUND";
      if (session.healthResult === null) return "RESULT_MISSING";

      const startsAt = session.subscription?.endsAt !== null && session.subscription?.endsAt !== undefined && session.subscription.endsAt > processedAt
        ? session.subscription.endsAt
        : processedAt;
      const endsAt = new Date(startsAt);
      endsAt.setUTCDate(endsAt.getUTCDate() + subscriptionDurationDays);
      await transaction.paymentEvent.create({ data: { sessionId, paymentEventId, status: "SUCCEEDED", processedAt } });
      await transaction.subscription.upsert({
        where: { sessionId },
        create: { sessionId, status: "ACTIVE", startsAt, endsAt },
        update: { status: "ACTIVE", startsAt, endsAt },
      });
      return "SUCCEEDED";
    });
  }
}
