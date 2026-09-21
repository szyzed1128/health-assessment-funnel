import { z } from "zod";

import { calculateHealthAssessment, type HealthAssessment, type HealthAssessmentInput } from "@/modules/health/health-assessment-algorithm";
import type { HealthRepository } from "@/modules/health/health-repository";
import { questionDefinitions, requiredQuestionKeys } from "@/modules/assessment/question-definition";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

const healthInputSchema = z.object({
  gender: questionDefinitions.gender.schema,
  goal: questionDefinitions.goal.schema,
  age: questionDefinitions.age.schema,
  heightCm: questionDefinitions.heightCm.schema,
  currentWeightKg: questionDefinitions.currentWeightKg.schema,
  targetWeightKg: questionDefinitions.targetWeightKg.schema,
  exerciseFrequency: questionDefinitions.exerciseFrequency.schema,
});

export function createHealthService(repository: HealthRepository, now = () => new Date()) {
  return {
    async assessSession(sessionId: string): Promise<HealthAssessment> {
      const record = await repository.findSessionWithAnswers(sessionId);

      if (record === null) {
        throw new NotFoundError("Assessment session was not found.");
      }

      const answers = Object.fromEntries(record.answers.map((answer) => [answer.questionKey, answer.value]));
      if (!requiredQuestionKeys.every((questionKey) => questionKey in answers)) {
        throw new ValidationError("Complete all required assessment questions before calculating results.");
      }

      const parsedInput = healthInputSchema.safeParse(answers);
      if (!parsedInput.success) {
        throw new ValidationError("Stored assessment answers are invalid for health calculation.");
      }

      try {
        const assessment = calculateHealthAssessment(parsedInput.data as HealthAssessmentInput, now());
        await repository.saveAssessment(sessionId, assessment);
        return assessment;
      } catch (error) {
        if (error instanceof RangeError) {
          throw new ValidationError(error.message);
        }

        throw error;
      }
    },
  };
}
