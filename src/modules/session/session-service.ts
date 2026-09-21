import {
  getNextQuestionKey,
  getNextStep,
  isAssessmentComplete,
} from "@/modules/assessment/question-definition";
import {
  getWeightGoalValidationError,
  normalizeGoal,
} from "@/modules/health/health-assessment-algorithm";
import type { PersistedAnswer, PersistedSession, SessionRepository } from "@/modules/session/session-repository";
import { getTargetDateBounds, isValidIsoDate } from "@/shared/date-utils";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

export type SessionProgress = {
  sessionId: string;
  status: PersistedSession["status"];
  currentStep: number;
  nextQuestionKey: string | null;
  answers: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export function toSessionProgress(
  session: PersistedSession,
  answers: PersistedAnswer[],
): SessionProgress {
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionKey, answer.value]));

  return {
    sessionId: session.id,
    status: session.status,
    currentStep: session.currentStep,
    nextQuestionKey: getNextQuestionKey(answerMap),
    answers: answerMap,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function deriveSessionState(answers: PersistedAnswer[]): Pick<PersistedSession, "currentStep" | "status"> {
  validateAnswerRelationships(answers);
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionKey, answer.value]));
  const currentStep = getNextStep(answerMap);

  return {
    currentStep,
    status: isAssessmentComplete(answerMap)
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
  const effectiveGoal = values.get("effectiveGoal");
  const height = values.get("heightCm");
  const currentWeight = values.get("currentWeightKg");
  const targetWeight = values.get("targetWeightKg");
  const bigDayType = values.get("bigDayType");
  const bigDayDate = values.get("bigDayDate");
  const targetDateSource = values.get("targetDateSource");

  if (typeof currentWeight === "number" && typeof targetWeight === "number") {
    const weightGoalError = getWeightGoalValidationError({
      goal: normalizeGoal(effectiveGoal) ?? normalizeGoal(goal),
      heightCm: typeof height === "number" ? height : undefined,
      currentWeightKg: currentWeight,
      targetWeightKg: targetWeight,
    });
    if (weightGoalError !== null) {
      throw new ValidationError(weightGoalError);
    }
  }

  if (bigDayType === "none" && targetDateSource === "important_date") {
    throw new ValidationError("An important date is required when it is selected as the target date.");
  }

  if (typeof bigDayDate === "string") {
    const bounds = getTargetDateBounds(new Date());
    if (!isValidIsoDate(bigDayDate) || bigDayDate < bounds.min || bigDayDate > bounds.max) {
      throw new ValidationError("Important date must be a real date from 14 to 730 days after today.");
    }
  }

  // Missing dependent answers are allowed during out-of-order incremental saves.
  // The health assessment boundary validates completeness before calculation.
}
