import type { AssessmentRepository } from "@/modules/assessment/assessment-repository";
import { deriveSessionState, toSessionProgress, type SessionProgress } from "@/modules/session/session-service";
import { getQuestionDefinition, isQuestionKey, type QuestionKey } from "@/modules/assessment/question-definition";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

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
      );

      if (record.kind === "NOT_FOUND") {
        throw new NotFoundError("Assessment session was not found.");
      }

      return toSessionProgress(record.record.session, record.record.answers);
    },
  };
}
