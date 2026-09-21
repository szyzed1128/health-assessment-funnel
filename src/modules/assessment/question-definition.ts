import { z } from "zod";

import { normalizeGoal } from "@/modules/health/health-assessment-algorithm";
import { isValidIsoDate } from "@/shared/date-utils";

export const questionDefinitions = {
  gender: {
    step: 0,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]),
  },
  goal: {
    step: 1,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z
      .enum(["lose_weight", "maintain_weight", "gain_weight", "improve_fitness"])
      .transform((value) => normalizeGoal(value)!),
  },
  age: {
    step: 2,
    required: true,
    answerType: "NUMBER",
    schema: z.number().int().min(18).max(100),
  },
  heightCm: {
    step: 3,
    required: true,
    answerType: "NUMBER",
    schema: z.number().min(100).max(250),
  },
  currentWeightKg: {
    step: 4,
    required: true,
    answerType: "NUMBER",
    schema: z.number().min(30).max(350),
  },
  goalResolutionConfirmed: {
    step: 5,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.literal("confirmed"),
  },
  targetWeightKg: {
    step: 6,
    required: true,
    answerType: "NUMBER",
    schema: z.number().min(30).max(350),
  },
  bigDayType: {
    step: 7,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.enum([
      "none",
      "birthday",
      "interview",
      "wedding",
      "travel",
      "graduation",
      "family_event",
      "other",
    ]),
  },
  bigDayDate: {
    step: 7,
    required: false,
    answerType: "DATE",
    schema: z.string().refine(isValidIsoDate, "Date must be a real calendar date."),
  },
  targetDateSource: {
    step: 8,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.enum(["system", "important_date"]),
  },
  exerciseFrequency: {
    step: 9,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.enum(["never", "one_to_two_times_weekly", "three_to_four_times_weekly", "five_plus_times_weekly"]),
  },
  targetAreas: {
    step: 8,
    required: false,
    answerType: "MULTI_SELECT",
    schema: z
      .array(z.enum(["belly", "thighs", "arms", "back", "glutes"]))
      .min(1)
      .max(5)
      .refine((values) => new Set(values).size === values.length, "Selections must be unique."),
  },
} as const;

export type QuestionKey = keyof typeof questionDefinitions;
export type AnswerType = (typeof questionDefinitions)[QuestionKey]["answerType"];
export type AnswerSnapshot = Record<string, unknown>;

export const questionKeys = Object.keys(questionDefinitions) as QuestionKey[];
export const requiredQuestionKeys = questionKeys.filter(
  (questionKey) =>
    questionDefinitions[questionKey].required !== false &&
    questionKey !== "bigDayDate" &&
    questionKey !== "goalResolutionConfirmed",
);

export function isQuestionKey(value: string): value is QuestionKey {
  return value in questionDefinitions;
}

export function getQuestionDefinition(questionKey: QuestionKey) {
  return questionDefinitions[questionKey];
}

export function getRequiredQuestionKeys(answers: AnswerSnapshot): QuestionKey[] {
  return questionKeys.filter((questionKey) => {
    const definition = questionDefinitions[questionKey];
    if (questionKey === "goalResolutionConfirmed") {
      return (
        (answers.goalResolution === "REDIRECT_TO_GAIN" ||
          answers.goalResolution === "REDIRECT_TO_LOSS" ||
          answers.goalResolution === "BLOCKED_LOSS") &&
        answers.goalResolutionConfirmed !== "confirmed"
      );
    }

    if (definition.required === false) {
      return questionKey === "bigDayDate" && answers.bigDayType !== undefined && answers.bigDayType !== "none";
    }

    return true;
  });
}

export function getNextQuestionKey(answers: AnswerSnapshot): QuestionKey | null {
  const requiredKeys = getRequiredQuestionKeys(answers);
  const nextQuestion = requiredKeys.find((questionKey) => !(questionKey in answers));

  return nextQuestion ?? null;
}

export function getNextStep(answersOrKeys: AnswerSnapshot | Iterable<string>) {
  if (isIterable(answersOrKeys)) {
    const answeredKeys = new Set(answersOrKeys);
    const nextQuestion = requiredQuestionKeys.find((questionKey) => !answeredKeys.has(questionKey));

    return nextQuestion === undefined
      ? requiredQuestionKeys.length
      : requiredQuestionKeys.indexOf(nextQuestion);
  }

  const answers = answersOrKeys;
  const requiredKeys = getRequiredQuestionKeys(answers);
  const nextQuestion = getNextQuestionKey(answers);

  return nextQuestion === null ? requiredKeys.length : requiredKeys.indexOf(nextQuestion);
}

export function isAssessmentComplete(answersOrKeys: AnswerSnapshot | Iterable<string>) {
  if (isIterable(answersOrKeys)) {
    const answeredKeys = new Set(answersOrKeys);
    return requiredQuestionKeys.every((questionKey) => answeredKeys.has(questionKey));
  }

  const answers = answersOrKeys;
  return getNextQuestionKey(answers) === null;
}

function isIterable(value: AnswerSnapshot | Iterable<string>): value is Iterable<string> {
  return typeof value === "object" && value !== null && Symbol.iterator in value;
}
