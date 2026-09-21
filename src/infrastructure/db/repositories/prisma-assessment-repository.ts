import { AssessmentAnswerType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import type { AnswerWrite, AssessmentRepository, SaveAnswerOutcome } from "@/modules/assessment/assessment-repository";
import type { SessionWithAnswers } from "@/modules/session/session-repository";

const maxTransactionAttempts = 5;

export class PrismaAssessmentRepository implements AssessmentRepository {
  async saveAnswerAndUpdateProgress(
    answer: AnswerWrite,
    deriveState: (answers: SessionWithAnswers["answers"]) => {
      currentStep: number;
      status: SessionWithAnswers["session"]["status"];
    },
  ): Promise<SaveAnswerOutcome> {
    for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${answer.sessionId}))`;

            const session = await transaction.assessmentSession.findUnique({
              where: { id: answer.sessionId },
            });

            if (session === null) {
              return { kind: "NOT_FOUND" };
            }

            await transaction.assessmentAnswer.upsert({
              where: {
                sessionId_questionKey: {
                  sessionId: answer.sessionId,
                  questionKey: answer.questionKey,
                },
              },
              create: {
                sessionId: answer.sessionId,
                questionKey: answer.questionKey,
                answerType: answer.answerType as AssessmentAnswerType,
                value: answer.value as Prisma.InputJsonValue,
              },
              update: {
                answerType: answer.answerType as AssessmentAnswerType,
                value: answer.value as Prisma.InputJsonValue,
              },
            });

            const answers = await transaction.assessmentAnswer.findMany({
              where: { sessionId: answer.sessionId },
            });
            const nextState = deriveState(answers);
            if (session.status === "ASSESSED") {
              await transaction.healthAssessmentResult.deleteMany({ where: { sessionId: answer.sessionId } });
            }
            const updatedSession = await transaction.assessmentSession.update({
              where: { id: answer.sessionId },
              data: nextState,
            });

            return {
              kind: "SAVED",
              record: {
                session: updatedSession,
                answers: answers.map((persistedAnswer) => ({
                  questionKey: persistedAnswer.questionKey,
                  value: persistedAnswer.value,
                })),
              },
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        );
      } catch (error) {
        if (isSerializationConflict(error) && attempt < maxTransactionAttempts) {
          await delay(attempt * 15);
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unable to save assessment answer after transaction retries.");
  }
}

function isSerializationConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
