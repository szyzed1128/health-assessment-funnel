import { getNextStep, isAssessmentComplete, requiredQuestionKeys } from "@/modules/assessment/question-definition";
import type { PersistedAnswer, PersistedSession, SessionRepository } from "@/modules/session/session-repository";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

export type SessionProgress = {
  sessionId: string;
  status: PersistedSession["status"];
  currentStep: number;
  nextQuestionKey: string | null;
  answers: Record<string, unknown>;
  updatedAt: Date;
};

export function toSessionProgress(
  session: PersistedSession,
  answers: PersistedAnswer[],
): SessionProgress {
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionKey, answer.value]));
  const nextQuestionKey = requiredQuestionKeys.find((questionKey) => !(questionKey in answerMap)) ?? null;

  return {
    sessionId: session.id,
    status: session.status,
    currentStep: session.currentStep,
    nextQuestionKey,
    answers: answerMap,
    updatedAt: session.updatedAt,
  };
}

export function deriveSessionState(answers: PersistedAnswer[]): Pick<PersistedSession, "currentStep" | "status"> {
  validateAnswerRelationships(answers);
  const answeredQuestionKeys = answers.map((answer) => answer.questionKey);
  const currentStep = getNextStep(answeredQuestionKeys);

  return {
    currentStep,
    status: isAssessmentComplete(answeredQuestionKeys)
      ? "READY_FOR_ASSESSMENT"
      : "IN_PROGRESS",
  };
}

export function createSessionService(repository: SessionRepository) {
  return {
    async createSession() {
      const session = await repository.create();
      return toSessionProgress(session, []);
    },
    async getSessionProgress(sessionId: string): Promise<SessionProgress> {
      const record = await repository.findWithAnswers(sessionId);

      if (record === null) {
        throw new NotFoundError("Assessment session was not found.");
      }

      return toSessionProgress(record.session, record.answers);
    },
  };
}

function validateAnswerRelationships(answers: PersistedAnswer[]) {
  const values = new Map(answers.map((answer) => [answer.questionKey, answer.value]));
  const goal = values.get("goal");
  const currentWeight = values.get("currentWeightKg");
  const targetWeight = values.get("targetWeightKg");

  if (goal === "lose_weight" && typeof currentWeight === "number" && typeof targetWeight === "number") {
    if (targetWeight >= currentWeight) {
      throw new ValidationError("Target weight must be lower than current weight for a weight-loss goal.");
    }
  }

  if (goal === "maintain_weight" && typeof currentWeight === "number" && typeof targetWeight === "number") {
    if (Math.abs(targetWeight - currentWeight) > 2) {
      throw new ValidationError("Target weight must stay within 2 kg for a maintenance goal.");
    }
  }
}
