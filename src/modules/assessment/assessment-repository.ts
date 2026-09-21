import type { AnswerType } from "@/modules/assessment/question-definition";
import type { SessionStatus, SessionWithAnswers } from "@/modules/session/session-repository";

export type AnswerWrite = {
  sessionId: string;
  questionKey: string;
  answerType: AnswerType;
  value: unknown;
};

export type DerivedAnswerWrite = Pick<AnswerWrite, "questionKey" | "answerType" | "value">;

export type DerivedAnswerSync = {
  upserts: DerivedAnswerWrite[];
  deleteQuestionKeys: string[];
};

export type SaveAnswerOutcome =
  | { kind: "NOT_FOUND" }
  | { kind: "SAVED"; record: SessionWithAnswers };

export interface AssessmentRepository {
  saveAnswerAndUpdateProgress(
    answer: AnswerWrite,
    deriveState: (answers: SessionWithAnswers["answers"]) => {
      currentStep: number;
      status: SessionStatus;
    },
    deriveAdditionalAnswers?: (
      answers: SessionWithAnswers["answers"],
      changedQuestionKey: string,
    ) => DerivedAnswerSync,
  ): Promise<SaveAnswerOutcome>;
}
