import { describe, expect, it } from "vitest";

import {
  getNextStep,
  isAssessmentComplete,
  requiredQuestionKeys,
} from "@/modules/assessment/question-definition";

describe("assessment question definitions", () => {
  it("keeps question order stable even when answers were submitted out of order", () => {
    expect(getNextStep(["targetWeightKg", "exerciseFrequency"])).toBe(0);
    expect(getNextStep(["gender", "goal", "age"])).toBe(3);
  });

  it("only marks the assessment complete when every required key has an answer", () => {
    expect(isAssessmentComplete(requiredQuestionKeys.slice(0, -1))).toBe(false);
    expect(isAssessmentComplete(requiredQuestionKeys)).toBe(true);
  });
});
