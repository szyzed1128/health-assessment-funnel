import { prisma } from "@/infrastructure/db/prisma";
import type { ResultAccessRecord, SubscriptionRepository } from "@/modules/subscription/subscription-repository";

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async findResultAccess(sessionId: string): Promise<ResultAccessRecord> {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { healthResult: true, subscription: true, answers: true },
    });
    if (session === null) {
      return { sessionExists: false, healthResult: null, subscription: null, targetWeightDifferenceKg: 0 };
    }

    const answers = new Map(session.answers.map((answer) => [answer.questionKey, answer.value]));
    const currentWeightKg = answers.get("currentWeightKg");
    const targetWeightKg = answers.get("targetWeightKg");
    const targetWeightDifferenceKg = typeof currentWeightKg === "number" && typeof targetWeightKg === "number"
      ? Math.round((targetWeightKg - currentWeightKg) * 100) / 100
      : 0;

    return {
      sessionExists: true,
      healthResult: session.healthResult === null ? null : {
        bmi: session.healthResult.bmi?.toNumber() ?? 0,
        recommendedDailyCalories: session.healthResult.recommendedDailyCalories ?? 0,
        targetDate: session.healthResult.targetDate ?? new Date(0),
        weeklyForecast: session.healthResult.weeklyForecast,
        actionPlan: session.healthResult.actionPlan,
      },
      subscription: session.subscription,
      targetWeightDifferenceKg,
    };
  }
}
