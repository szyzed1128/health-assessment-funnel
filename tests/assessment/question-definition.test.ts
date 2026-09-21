import { describe, expect, it } from "vitest";

import {
  getNextQuestionKey,
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
    const completeAnswers = Object.fromEntries(
      requiredQuestionKeys.map((questionKey) => [
        questionKey,
        questionKey === "bigDayType" ? "none" : "value",
      ]),
    );

    expect(isAssessmentComplete(Object.fromEntries(Object.entries(completeAnswers).slice(0, -1)))).toBe(false);
    expect(isAssessmentComplete(completeAnswers)).toBe(true);
    expect(isAssessmentComplete(requiredQuestionKeys)).toBe(true);
    expect(getNextStep(requiredQuestionKeys)).toBe(requiredQuestionKeys.length);
  });

  it("places the BMI confirmation before the target weight question", () => {
    expect(getNextQuestionKey({
      gender: "female",
      goal: "maintain_weight",
      age: 32,
      heightCm: 168,
      currentWeightKg: 75,
      effectiveGoal: "lose_weight",
      goalResolution: "REDIRECT_TO_LOSS",
    })).toBe("goalResolutionConfirmed");

    expect(getNextQuestionKey({
      gender: "female",
      goal: "maintain_weight",
      age: 32,
      heightCm: 168,
      currentWeightKg: 75,
      effectiveGoal: "lose_weight",
      goalResolution: "REDIRECT_TO_LOSS",
      goalResolutionConfirmed: "confirmed",
    })).toBe("targetWeightKg");
  });
});
