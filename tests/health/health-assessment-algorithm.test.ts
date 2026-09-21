import { describe, expect, it } from "vitest";

import { calculateHealthAssessment } from "@/modules/health/health-assessment-algorithm";

const input = {
  gender: "female",
  goal: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 75,
  targetWeightKg: 65,
  exerciseFrequency: "one_to_two_times_weekly",
} as const;

describe("health assessment algorithm", () => {
  it("calculates BMI, calorie recommendation, target date, and weekly forecast", () => {
    const result = calculateHealthAssessment(input, new Date("2026-01-01T00:00:00.000Z"));

    expect(result.bmi).toBe(26.57);
    expect(result.recommendedDailyCalories).toBe(1534);
    expect(result.targetDate.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(result.weeklyForecast.weeksToTarget).toBe(20);
    expect(result.weeklyForecast.expectedWeeklyChangeKg).toBe(-0.5);
    expect(result.weeklyForecast.points.at(0)).toEqual({ week: 1, projectedWeightKg: 74.5 });
    expect(result.weeklyForecast.points.at(-1)).toEqual({ week: 20, projectedWeightKg: 65 });
  });

  it("applies the documented 1000 kcal/day lower bound for weight-loss recommendations", () => {
    const result = calculateHealthAssessment(
      { ...input, age: 100, heightCm: 100, currentWeightKg: 31, targetWeightKg: 30 },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.recommendedDailyCalories).toBe(1000);
  });

  it("applies the calorie lower bound to maintenance recommendations too", () => {
    const result = calculateHealthAssessment(
      { ...input, goal: "maintain_weight", age: 100, heightCm: 100, currentWeightKg: 31, targetWeightKg: 30 },
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
  ])("rejects invalid or contradictory input", (invalidInput, message) => {
    expect(() => calculateHealthAssessment(invalidInput as typeof input)).toThrow(message);
  });
});
