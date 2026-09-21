export const healthAlgorithmVersion = "v1-mifflin-simple";

export type HealthAssessmentInput = {
  gender: "female" | "male" | "non_binary" | "prefer_not_to_say";
  goal: "lose_weight" | "maintain_weight" | "improve_fitness";
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  exerciseFrequency: "never" | "one_to_two_times_weekly" | "three_to_four_times_weekly" | "five_plus_times_weekly";
};

export type WeeklyForecast = {
  weeksToTarget: number;
  expectedWeeklyChangeKg: number;
  points: Array<{ week: number; projectedWeightKg: number }>;
};

export type HealthAssessment = {
  bmi: number;
  recommendedDailyCalories: number;
  targetDate: Date;
  weeklyForecast: WeeklyForecast;
  algorithmVersion: typeof healthAlgorithmVersion;
  computedAt: Date;
};

const activityMultipliers = {
  never: 1.2,
  one_to_two_times_weekly: 1.375,
  three_to_four_times_weekly: 1.55,
  five_plus_times_weekly: 1.725,
} as const;

const sexAdjustments = {
  female: -161,
  male: 5,
  non_binary: -78,
  prefer_not_to_say: -78,
} as const;

const expectedWeeklyChangeKg = 0.5;
const maximumForecastPoints = 26;

export function calculateHealthAssessment(
  input: HealthAssessmentInput,
  computedAt = new Date(),
): HealthAssessment {
  validateInput(input);

  const bmi = roundToTwoDecimals(input.currentWeightKg / Math.pow(input.heightCm / 100, 2));
  const restingEnergyExpenditure =
    10 * input.currentWeightKg +
    6.25 * input.heightCm -
    5 * input.age +
    sexAdjustments[input.gender];
  const maintenanceCalories = Math.round(
    restingEnergyExpenditure * activityMultipliers[input.exerciseFrequency],
  );
  const calorieTarget = input.goal === "lose_weight"
    ? maintenanceCalories - 500
    : maintenanceCalories;
  const recommendedDailyCalories = Math.max(1000, calorieTarget);
  const weightDifferenceKg = input.targetWeightKg - input.currentWeightKg;
  const weeksToTarget = Math.ceil(Math.abs(weightDifferenceKg) / expectedWeeklyChangeKg);
  const targetDate = new Date(computedAt);
  targetDate.setUTCDate(targetDate.getUTCDate() + weeksToTarget * 7);

  return {
    bmi,
    recommendedDailyCalories,
    targetDate,
    weeklyForecast: buildForecast(input.currentWeightKg, input.targetWeightKg, weeksToTarget),
    algorithmVersion: healthAlgorithmVersion,
    computedAt,
  };
}

function buildForecast(
  currentWeightKg: number,
  targetWeightKg: number,
  weeksToTarget: number,
): WeeklyForecast {
  const direction = Math.sign(targetWeightKg - currentWeightKg);
  const pointCount = Math.min(weeksToTarget, maximumForecastPoints);
  const points = Array.from({ length: pointCount }, (_, index) => {
    const week = index + 1;
    const projectedWeightKg = week === weeksToTarget
      ? targetWeightKg
      : currentWeightKg + direction * expectedWeeklyChangeKg * week;

    return { week, projectedWeightKg: roundToTwoDecimals(projectedWeightKg) };
  });

  return {
    weeksToTarget,
    expectedWeeklyChangeKg: direction * expectedWeeklyChangeKg,
    points,
  };
}

function validateInput(input: HealthAssessmentInput) {
  if (!Number.isFinite(input.heightCm) || input.heightCm < 100 || input.heightCm > 250) {
    throw new RangeError("Height must be between 100 and 250 cm.");
  }

  if (!Number.isFinite(input.currentWeightKg) || input.currentWeightKg < 30 || input.currentWeightKg > 350) {
    throw new RangeError("Current weight must be between 30 and 350 kg.");
  }

  if (!Number.isFinite(input.targetWeightKg) || input.targetWeightKg < 30 || input.targetWeightKg > 350) {
    throw new RangeError("Target weight must be between 30 and 350 kg.");
  }

  if (!Number.isInteger(input.age) || input.age < 18 || input.age > 100) {
    throw new RangeError("Age must be an adult whole number between 18 and 100.");
  }

  if (input.goal === "lose_weight" && input.targetWeightKg >= input.currentWeightKg) {
    throw new RangeError("A weight-loss target must be lower than current weight.");
  }

  if (input.goal === "maintain_weight" && Math.abs(input.targetWeightKg - input.currentWeightKg) > 2) {
    throw new RangeError("A maintenance target must remain within 2 kg of current weight.");
  }
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}
