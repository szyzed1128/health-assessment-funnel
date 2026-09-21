import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import type { HealthAssessment } from "@/modules/health/health-assessment-algorithm";
import type { HealthRepository } from "@/modules/health/health-repository";
import type { SessionWithAnswers } from "@/modules/session/session-repository";

export class PrismaHealthRepository implements HealthRepository {
  async findSessionWithAnswers(sessionId: string): Promise<SessionWithAnswers | null> {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { answers: true },
    });

    if (session === null) {
      return null;
    }

    return {
      session,
      answers: session.answers.map((answer) => ({
        questionKey: answer.questionKey,
        value: answer.value,
      })),
    };
  }

  async saveAssessment(sessionId: string, assessment: HealthAssessment): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await transaction.healthAssessmentResult.upsert({
        where: { sessionId },
        create: {
          sessionId,
          bmi: assessment.bmi,
          recommendedDailyCalories: assessment.recommendedDailyCalories,
          targetDate: assessment.targetDate,
          weeklyForecast: assessment.weeklyForecast as Prisma.InputJsonValue,
          algorithmVersion: assessment.algorithmVersion,
          computedAt: assessment.computedAt,
        },
        update: {
          bmi: assessment.bmi,
          recommendedDailyCalories: assessment.recommendedDailyCalories,
          targetDate: assessment.targetDate,
          weeklyForecast: assessment.weeklyForecast as Prisma.InputJsonValue,
          algorithmVersion: assessment.algorithmVersion,
          computedAt: assessment.computedAt,
        },
      });

      await transaction.assessmentSession.update({
        where: { id: sessionId },
        data: { status: "ASSESSED" },
      });
    });
  }
}
