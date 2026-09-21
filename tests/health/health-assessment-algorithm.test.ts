import { describe, expect, it } from "vitest";

import { calculateBmiPreview, calculateHealthAssessment } from "@/modules/health/health-assessment-algorithm";

const input = {
  gender: "female",
  goal: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 75,
  targetWeightKg: 65,
  bigDayType: "wedding",
  bigDayDate: "2026-05-21",
  targetDateSource: "important_date",
  exerciseFrequency: "one_to_two_times_weekly",
} as const;

describe("health assessment algorithm", () => {
  it("calculates BMI, calorie recommendation, target date, and weekly forecast", () => {
    const result = calculateHealthAssessment(input, new Date("2026-01-01T00:00:00.000Z"));

    expect(result.bmi).toBe(26.57);
    expect(result.recommendedDailyCalories).toBe(1484);
    expect(result.targetDate.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(result.requestedTargetDate?.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(result.targetDateSource).toBe("IMPORTANT_DATE");
    expect(result.forecastTargetDate.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(result.weeklyForecast.weeksToTarget).toBe(20);
    expect(result.weeklyForecast.expectedWeeklyChangeKg).toBe(-0.5);
    expect(result.weeklyForecast.points.at(0)).toEqual({ week: 1, projectedWeightKg: 74.28 });
    expect(result.weeklyForecast.points.at(-1)).toEqual({ week: 20, projectedWeightKg: 65 });
  });

  it("uses the system prediction when no important date is selected", () => {
    const result = calculateHealthAssessment(
      { ...input, bigDayType: "none", bigDayDate: undefined, targetDateSource: "system" },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.targetDateSource).toBe("SYSTEM");
    expect(result.requestedTargetDate).toBeNull();
    expect(result.forecastTargetDate.toISOString()).toBe(result.targetDate.toISOString());
  });

  it("redirects maintenance to weight loss when BMI is above the normal range", () => {
    const preview = calculateBmiPreview({
      goal: "maintain_weight",
      heightCm: 168,
      currentWeightKg: 75,
    });

    expect(preview.bmi).toBe(26.57);
    expect(preview.category).toBe("HIGH");
    expect(preview.effectiveGoal).toBe("lose_weight");
    expect(preview.goalResolution).toBe("REDIRECT_TO_LOSS");
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.autoFillTargetWeightKg).toBeNull();
    expect(preview.recommendedTargetWeightRange).toEqual({ minKg: 52.2, maxKg: 67.6 });
  });

  it("auto-fills maintenance only when BMI is normal", () => {
    const preview = calculateBmiPreview({
      goal: "maintain_weight",
      heightCm: 168,
      currentWeightKg: 65,
    });

    expect(preview.bmi).toBe(23.03);
    expect(preview.category).toBe("NORMAL");
    expect(preview.effectiveGoal).toBe("maintain_weight");
    expect(preview.goalResolution).toBe("AUTO_MAINTAIN");
    expect(preview.requiresConfirmation).toBe(false);
    expect(preview.autoFillTargetWeightKg).toBe(65);
    expect(preview.recommendedTargetWeightRange).toBeNull();
  });

  it("preserves decimal current weight when auto-filling maintenance", () => {
    const preview = calculateBmiPreview({
      goal: "maintain_weight",
      heightCm: 168,
      currentWeightKg: 65.04,
    });

    expect(preview.autoFillTargetWeightKg).toBe(65.04);
  });

  it("redirects maintenance to weight gain when BMI is low", () => {
    const preview = calculateBmiPreview({
      goal: "maintain_weight",
      heightCm: 168,
      currentWeightKg: 50,
    });

    expect(preview.category).toBe("LOW");
    expect(preview.effectiveGoal).toBe("gain_weight");
    expect(preview.goalResolution).toBe("REDIRECT_TO_GAIN");
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.autoFillTargetWeightKg).toBeNull();
    expect(preview.recommendedTargetWeightRange).toEqual({ minKg: 52.2, maxKg: 67.6 });
  });

  it("blocks direct weight loss when BMI is low", () => {
    const preview = calculateBmiPreview({
      goal: "lose_weight",
      heightCm: 168,
      currentWeightKg: 50,
    });

    expect(preview.goalResolution).toBe("BLOCKED_LOSS");
    expect(preview.effectiveGoal).toBe("lose_weight");
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.recommendedTargetWeightRange).toBeNull();
  });

  it("uses the weight-loss range only for a weight-loss goal", () => {
    const preview = calculateBmiPreview({
      goal: "lose_weight",
      heightCm: 168,
      currentWeightKg: 75,
    });

    expect(preview.recommendedTargetWeightRange).toEqual({ minKg: 52.2, maxKg: 67.6 });
  });

  it("provides a healthy target range for a weight-gain goal", () => {
    const preview = calculateBmiPreview({
      goal: "gain_weight",
      heightCm: 168,
      currentWeightKg: 50,
    });

    expect(preview.category).toBe("LOW");
    expect(preview.recommendedTargetWeightRange).toEqual({ minKg: 52.2, maxKg: 67.6 });
  });

  it("rejects weight loss when current BMI is below the healthy range", () => {
    expect(() => calculateHealthAssessment(
      {
        ...input,
        currentWeightKg: 50,
        targetWeightKg: 45,
      },
      new Date("2026-01-01T00:00:00.000Z"),
    )).toThrow("weight-loss goal");
  });

  it("requires a weight-gain target to be higher than current weight", () => {
    expect(() => calculateHealthAssessment(
      {
        ...input,
        goal: "gain_weight",
        currentWeightKg: 50,
        targetWeightKg: 45,
      },
      new Date("2026-01-01T00:00:00.000Z"),
    )).toThrow("weight-gain target");
  });

  it("requires a weight-gain target to reach the recommended healthy range", () => {
    expect(() => calculateHealthAssessment(
      {
        ...input,
        goal: "gain_weight",
        currentWeightKg: 50,
        targetWeightKg: 50.1,
      },
      new Date("2026-01-01T00:00:00.000Z"),
    )).toThrow("between 52.2 and 67.6");
  });

  it("keeps BMI category boundaries based on the unrounded BMI", () => {
    const preview = calculateBmiPreview({
      goal: "lose_weight",
      heightCm: 168,
      currentWeightKg: 67.73,
    });

    expect(preview.bmi).toBe(24);
    expect(preview.category).toBe("NORMAL");
  });

  it("validates important dates against the stable assessment date", () => {
    const result = calculateHealthAssessment(
      { ...input, bigDayDate: "2026-01-15" },
      new Date("2026-01-02T12:00:00.000Z"),
      new Date("2026-01-01T12:00:00.000Z"),
    );

    expect(result.requestedTargetDate?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("does not suggest further weight loss below the healthy BMI range", () => {
    const preview = calculateBmiPreview({
      goal: "lose_weight",
      heightCm: 168,
      currentWeightKg: 50,
    });

    expect(preview.category).toBe("LOW");
    expect(preview.recommendedTargetWeightRange).toBeNull();
  });

  it("does not show an impossible loss range below the input minimum", () => {
    const preview = calculateBmiPreview({
      goal: "lose_weight",
      heightCm: 110,
      currentWeightKg: 30,
    });

    expect(preview.category).toBe("HIGH");
    expect(preview.recommendedTargetWeightRange).toBeNull();
  });

  it("applies the documented 1000 kcal/day lower bound for weight-loss recommendations", () => {
    const result = calculateHealthAssessment(
      { ...input, age: 100, heightCm: 140, currentWeightKg: 48, targetWeightKg: 46.9 },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.recommendedDailyCalories).toBe(1000);
  });

  it("applies the calorie lower bound to maintenance recommendations too", () => {
    const result = calculateHealthAssessment(
      {
        ...input,
        goal: "maintain_weight",
        age: 100,
        heightCm: 140,
        currentWeightKg: 45,
        targetWeightKg: 45,
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.recommendedDailyCalories).toBe(1000);
  });

  it.each([
    [{ ...input, heightCm: 0 }, "Height"],
    [{ ...input, currentWeightKg: 0 }, "Current weight"],
    [{ ...input, age: 17 }, "Age"],
    [{ ...input, age: 101 }, "Age"],
    [{ ...input, targetWeightKg: 75 }, "weight-loss target"],
    [{ ...input, goal: "maintain_weight", targetWeightKg: 70 }, "maintenance target"],
    [{ ...input, bigDayDate: "2026-01-10" }, "Target date"],
  ])("rejects invalid or contradictory input", (invalidInput, message) => {
    expect(() => calculateHealthAssessment(invalidInput as typeof input, new Date("2026-01-01T00:00:00.000Z"))).toThrow(message);
  });
});
