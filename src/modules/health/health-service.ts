import { z } from "zod";

import {
  calculateBmiPreview,
  calculateHealthAssessment,
  normalizeGoal,
  type BmiPreview,
  type HealthAssessment,
  type HealthAssessmentInput,
} from "@/modules/health/health-assessment-algorithm";
import type { HealthRepository } from "@/modules/health/health-repository";
import { getRequiredQuestionKeys, questionDefinitions } from "@/modules/assessment/question-definition";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

const healthInputSchema = z.object({
  gender: questionDefinitions.gender.schema,
  goal: questionDefinitions.goal.schema,
  age: questionDefinitions.age.schema,
  heightCm: questionDefinitions.heightCm.schema,
  currentWeightKg: questionDefinitions.currentWeightKg.schema,
  targetWeightKg: questionDefinitions.targetWeightKg.schema,
  bigDayType: questionDefinitions.bigDayType.schema,
  bigDayDate: questionDefinitions.bigDayDate.schema.optional(),
  targetDateSource: questionDefinitions.targetDateSource.schema,
  exerciseFrequency: questionDefinitions.exerciseFrequency.schema,
});

const bmiPreviewInputSchema = z.object({
  goal: questionDefinitions.goal.schema,
  heightCm: questionDefinitions.heightCm.schema,
  currentWeightKg: questionDefinitions.currentWeightKg.schema,
});

export function createHealthService(repository: HealthRepository, now = () => new Date()) {
  return {
    async assessSession(sessionId: string): Promise<HealthAssessment> {
      const record = await repository.findSessionWithAnswers(sessionId);

      if (record === null) {
        throw new NotFoundError("Assessment session was not found.");
      }

      const answers = Object.fromEntries(record.answers.map((answer) => [answer.questionKey, answer.value]));
      if (!getRequiredQuestionKeys(answers).every((questionKey) => questionKey in answers)) {
        throw new ValidationError("Complete all required assessment questions before calculating results.");
      }

      const parsedInput = healthInputSchema.safeParse({
        ...answers,
        goal: normalizeGoal(answers.effectiveGoal) ?? answers.goal,
      });
      if (!parsedInput.success) {
        throw new ValidationError("Stored assessment answers are invalid for health calculation.");
      }

      try {
        const computedAt = now();
        const assessment = calculateHealthAssessment(
          parsedInput.data as HealthAssessmentInput,
          computedAt,
          computedAt,
        );
        await repository.saveAssessment(sessionId, assessment);
        return assessment;
      } catch (error) {
        if (error instanceof RangeError) {
          throw new ValidationError(error.message);
        }

        throw error;
      }
    },

    async getBmiPreview(sessionId: string): Promise<BmiPreview> {
      const record = await repository.findSessionWithAnswers(sessionId);

      if (record === null) {
        throw new NotFoundError("Assessment session was not found.");
      }

      const answers = Object.fromEntries(record.answers.map((answer) => [answer.questionKey, answer.value]));
      const parsedInput = bmiPreviewInputSchema.safeParse({
        goal: answers.goal,
        heightCm: answers.heightCm,
        currentWeightKg: answers.currentWeightKg,
      });
      if (!parsedInput.success) {
        throw new ValidationError("Complete the height and current weight before requesting a BMI preview.");
      }

      try {
        return calculateBmiPreview(parsedInput.data);
      } catch (error) {
        if (error instanceof RangeError) {
          throw new ValidationError(error.message);
        }

        throw error;
      }
    },
  };
}
