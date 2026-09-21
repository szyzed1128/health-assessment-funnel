import { z } from "zod";

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
    schema: z.enum(["lose_weight", "maintain_weight", "improve_fitness"]),
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
  targetWeightKg: {
    step: 5,
    required: true,
    answerType: "NUMBER",
    schema: z.number().min(30).max(350),
  },
  exerciseFrequency: {
    step: 6,
    required: true,
    answerType: "SINGLE_SELECT",
    schema: z.enum(["never", "one_to_two_times_weekly", "three_to_four_times_weekly", "five_plus_times_weekly"]),
  },
  targetAreas: {
    step: 7,
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

export const questionKeys = Object.keys(questionDefinitions) as QuestionKey[];
export const requiredQuestionKeys = questionKeys.filter(
  (questionKey) => questionDefinitions[questionKey].required !== false,
);

export function isQuestionKey(value: string): value is QuestionKey {
  return value in questionDefinitions;
}

export function getQuestionDefinition(questionKey: QuestionKey) {
  return questionDefinitions[questionKey];
}

export function getNextStep(answeredQuestionKeys: Iterable<string>) {
  const answeredKeys = new Set(answeredQuestionKeys);
  const nextQuestion = requiredQuestionKeys.find((questionKey) => !answeredKeys.has(questionKey));

  return nextQuestion === undefined ? requiredQuestionKeys.length : questionDefinitions[nextQuestion].step;
}

export function isAssessmentComplete(answeredQuestionKeys: Iterable<string>) {
  return getNextStep(answeredQuestionKeys) === requiredQuestionKeys.length;
}
