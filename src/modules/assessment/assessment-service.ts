import type {
  AssessmentRepository,
  DerivedAnswerSync,
} from "@/modules/assessment/assessment-repository";
import { deriveSessionState, toSessionProgress, type SessionProgress } from "@/modules/session/session-service";
import {
  getQuestionDefinition,
  isQuestionKey,
  questionDefinitions,
  type QuestionKey,
} from "@/modules/assessment/question-definition";
import {
  calculateBmiPreview,
  getWeightGoalValidationError,
  type Goal,
} from "@/modules/health/health-assessment-algorithm";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";
import type { SessionWithAnswers } from "@/modules/session/session-repository";

export function createAssessmentService(repository: AssessmentRepository) {
  return {
    async saveAnswer(
      sessionId: string,
      questionKeyInput: string,
      rawValue: unknown,
    ): Promise<SessionProgress> {
      if (!isQuestionKey(questionKeyInput)) {
        throw new ValidationError("Unknown assessment question.");
      }

      const questionKey = questionKeyInput as QuestionKey;
      const definition = getQuestionDefinition(questionKey);
      const parsedValue = definition.schema.safeParse(rawValue);

      if (!parsedValue.success) {
        throw new ValidationError(`Invalid value for ${questionKey}.`);
      }

      const record = await repository.saveAnswerAndUpdateProgress(
        {
          sessionId,
          questionKey,
          answerType: definition.answerType,
          value: parsedValue.data,
        },
        deriveSessionState,
        deriveAutomaticAnswers,
      );

      if (record.kind === "NOT_FOUND") {
        throw new NotFoundError("Assessment session was not found.");
      }

      return toSessionProgress(record.record.session, record.record.answers);
    },
  };
}

function deriveAutomaticAnswers(
  answers: SessionWithAnswers["answers"],
  changedQuestionKey: string,
): DerivedAnswerSync {
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionKey, answer.value]));
  const parsedGoal = questionDefinitions.goal.schema.safeParse(answerMap.goal);
  const parsedHeight = questionDefinitions.heightCm.schema.safeParse(answerMap.heightCm);
  const parsedCurrentWeight = questionDefinitions.currentWeightKg.schema.safeParse(answerMap.currentWeightKg);
  const shouldReconcile =
    changedQuestionKey === "goal" ||
    changedQuestionKey === "heightCm" ||
    changedQuestionKey === "currentWeightKg";

  if (!shouldReconcile && changedQuestionKey !== "goalResolutionConfirmed") {
    return { upserts: [], deleteQuestionKeys: [] };
  }

  if (!parsedGoal.success || !parsedHeight.success || !parsedCurrentWeight.success) {
    return {
      upserts: [],
      deleteQuestionKeys: shouldReconcile
        ? ["effectiveGoal", "goalResolution", "goalResolutionConfirmed"]
        : [],
    };
  }

  const goal = parsedGoal.data as Goal;
  const preview = calculateBmiPreview({
    goal,
    heightCm: parsedHeight.data,
    currentWeightKg: parsedCurrentWeight.data,
  });

  const deleteQuestionKeys = shouldReconcile
    ? ["effectiveGoal", "goalResolution", "goalResolutionConfirmed"]
    : [];
  const existingTargetWeight = answerMap.targetWeightKg;
  if (
    shouldReconcile &&
    typeof existingTargetWeight === "number" &&
    preview.autoFillTargetWeightKg === null &&
    getWeightGoalValidationError({
      goal: preview.effectiveGoal,
      heightCm: parsedHeight.data,
      currentWeightKg: parsedCurrentWeight.data,
      targetWeightKg: existingTargetWeight,
    }) !== null
  ) {
    deleteQuestionKeys.push("targetWeightKg");
  }
  const upserts: DerivedAnswerSync["upserts"] = [
    {
      questionKey: "effectiveGoal",
      answerType: "SINGLE_SELECT" as const,
      value: preview.effectiveGoal,
    },
    {
      questionKey: "goalResolution",
      answerType: "SINGLE_SELECT" as const,
      value: preview.goalResolution,
    },
  ];

  if (preview.autoFillTargetWeightKg !== null) {
    upserts.push({
      questionKey: "targetWeightKg",
      answerType: questionDefinitions.targetWeightKg.answerType,
      value: preview.autoFillTargetWeightKg,
    });
  }

  if (changedQuestionKey === "goalResolutionConfirmed") {
    return { upserts, deleteQuestionKeys: [] };
  }

  return { upserts, deleteQuestionKeys };
}
