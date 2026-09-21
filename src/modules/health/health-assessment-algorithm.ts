import { isValidIsoDate } from "@/shared/date-utils";

export const healthAlgorithmVersion = "v2-goal-routing";

export type Goal = "lose_weight" | "maintain_weight" | "gain_weight";

export type GoalResolution =
  | "DIRECT"
  | "AUTO_MAINTAIN"
  | "REDIRECT_TO_GAIN"
  | "REDIRECT_TO_LOSS"
  | "BLOCKED_LOSS";

export type BigDayType =
  | "none"
  | "birthday"
  | "interview"
  | "wedding"
  | "travel"
  | "graduation"
  | "family_event"
  | "other";

export type TargetDateSource = "system" | "important_date";

export type BmiCategory = "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";

export type HealthAssessmentInput = {
  gender: "female" | "male" | "non_binary" | "prefer_not_to_say";
  goal: Goal;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  bigDayType: BigDayType;
  bigDayDate?: string;
  targetDateSource: TargetDateSource;
  exerciseFrequency: "never" | "one_to_two_times_weekly" | "three_to_four_times_weekly" | "five_plus_times_weekly";
};

export type BmiPreviewInput = {
  goal: Goal;
  heightCm: number;
  currentWeightKg: number;
};

export type BmiPreview = {
  bmi: number;
  category: BmiCategory;
  effectiveGoal: Goal;
  goalResolution: GoalResolution;
  requiresConfirmation: boolean;
  autoFillTargetWeightKg: number | null;
  recommendedTargetWeightRange: {
    minKg: number;
    maxKg: number;
  } | null;
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
  requestedTargetDate: Date | null;
  targetDateSource: "SYSTEM" | "IMPORTANT_DATE";
  forecastTargetDate: Date;
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

const maximumForecastPoints = 26;
const dayMilliseconds = 24 * 60 * 60 * 1000;
const expectedWeeklyChangeKg = 0.5;
const bmiHealthyLowerBound = 18.5;
const bmiHealthyUpperBound = 24;

export function normalizeGoal(value: unknown): Goal | null {
  if (value === "improve_fitness") return "gain_weight";
  if (value === "lose_weight" || value === "maintain_weight" || value === "gain_weight") {
    return value;
  }

  return null;
}

export function resolveGoal(input: {
  goal: Goal;
  heightCm: number;
  currentWeightKg: number;
}) {
  const rawBmi = calculateRawBmi(input.heightCm, input.currentWeightKg);

  if (input.goal === "maintain_weight") {
    if (rawBmi < bmiHealthyLowerBound) {
      return {
        effectiveGoal: "gain_weight" as const,
        goalResolution: "REDIRECT_TO_GAIN" as const,
        requiresConfirmation: true,
      };
    }

    if (rawBmi < bmiHealthyUpperBound) {
      return {
        effectiveGoal: "maintain_weight" as const,
        goalResolution: "AUTO_MAINTAIN" as const,
        requiresConfirmation: false,
      };
    }

    return {
      effectiveGoal: "lose_weight" as const,
      goalResolution: "REDIRECT_TO_LOSS" as const,
      requiresConfirmation: true,
    };
  }

  if (input.goal === "lose_weight" && rawBmi < bmiHealthyLowerBound) {
    return {
      effectiveGoal: "lose_weight" as const,
      goalResolution: "BLOCKED_LOSS" as const,
      requiresConfirmation: true,
    };
  }

  return {
    effectiveGoal: input.goal,
    goalResolution: "DIRECT" as const,
    requiresConfirmation: false,
  };
}

export function calculateHealthAssessment(
  input: HealthAssessmentInput,
  computedAt = new Date(),
  dateReferenceAt = computedAt,
): HealthAssessment {
  validateInput(input);

  const rawBmi = calculateRawBmi(input.heightCm, input.currentWeightKg);
  const bmi = roundToTwoDecimals(rawBmi);
  const weightDifferenceKg = input.targetWeightKg - input.currentWeightKg;
  const predictedWeeksToTarget = Math.max(1, Math.ceil(Math.abs(weightDifferenceKg) / expectedWeeklyChangeKg));
  const predictedTargetDate = new Date(computedAt);
  predictedTargetDate.setUTCDate(predictedTargetDate.getUTCDate() + predictedWeeksToTarget * 7);
  const importantDate = input.bigDayType === "none" || input.bigDayDate === undefined
    ? null
    : parseTargetTiming(input.bigDayDate, dateReferenceAt);
  const requestedTargetDate = importantDate?.targetDate ?? null;
  const targetDateSource = input.targetDateSource === "important_date" ? "IMPORTANT_DATE" : "SYSTEM";
  const forecastTargetDate = targetDateSource === "IMPORTANT_DATE"
    ? importantDate!.targetDate
    : predictedTargetDate;
  const forecastWeeksToTarget = targetDateSource === "IMPORTANT_DATE"
    ? importantDate!.weeksToTarget
    : predictedWeeksToTarget;
  const restingEnergyExpenditure =
    10 * input.currentWeightKg +
    6.25 * input.heightCm -
    5 * input.age +
    sexAdjustments[input.gender];
  const maintenanceCalories = Math.round(
    restingEnergyExpenditure * activityMultipliers[input.exerciseFrequency],
  );
  const desiredDailyAdjustment = Math.round(
    ((input.targetWeightKg - input.currentWeightKg) * 7700) /
      Math.max(1, Math.ceil((forecastTargetDate.getTime() - startOfUtcDay(computedAt).getTime()) / dayMilliseconds)),
  );
  const calorieTarget = input.goal === "maintain_weight"
    ? maintenanceCalories
    : maintenanceCalories + clamp(desiredDailyAdjustment, -750, 300);
  const recommendedDailyCalories = Math.max(1000, calorieTarget);

  return {
    bmi,
    recommendedDailyCalories,
    targetDate: predictedTargetDate,
    requestedTargetDate,
    targetDateSource,
    forecastTargetDate,
    weeklyForecast: buildForecast(input.currentWeightKg, input.targetWeightKg, forecastWeeksToTarget),
    algorithmVersion: healthAlgorithmVersion,
    computedAt,
  };
}

export function calculateBmiPreview(input: BmiPreviewInput): BmiPreview {
  validateBmiPreviewInput(input);

  const rawBmi = calculateRawBmi(input.heightCm, input.currentWeightKg);
  const bmi = roundToTwoDecimals(rawBmi);
  const category = getBmiCategory(rawBmi);
  const resolution = resolveGoal(input);
  const recommendedTargetWeightRange = resolution.effectiveGoal === "lose_weight"
    ? getWeightLossTargetWeightRange(input.heightCm, input.currentWeightKg, rawBmi)
    : resolution.effectiveGoal === "gain_weight"
      ? getWeightGainTargetWeightRange(input.heightCm, input.currentWeightKg, rawBmi)
      : null;
  const canAutoFillMaintenanceTarget = resolution.goalResolution === "AUTO_MAINTAIN";

  return {
    bmi,
    category,
    effectiveGoal: resolution.effectiveGoal,
    goalResolution: resolution.goalResolution,
    requiresConfirmation: resolution.requiresConfirmation,
    autoFillTargetWeightKg: canAutoFillMaintenanceTarget
      ? input.currentWeightKg
      : null,
    recommendedTargetWeightRange,
  };
}

function buildForecast(
  currentWeightKg: number,
  targetWeightKg: number,
  weeksToTarget: number,
): WeeklyForecast {
  const pointCount = Math.min(Math.max(weeksToTarget, 1), maximumForecastPoints);
  const points = Array.from({ length: pointCount }, (_, index) => {
    const week = pointCount === 1
      ? weeksToTarget
      : Math.round(1 + (index / (pointCount - 1)) * (weeksToTarget - 1));
    const progress = 1 - Math.pow(1 - week / weeksToTarget, 1.45);
    const projectedWeightKg = index === pointCount - 1
      ? targetWeightKg
      : currentWeightKg + (targetWeightKg - currentWeightKg) * progress;

    return { week, projectedWeightKg: roundToTwoDecimals(projectedWeightKg) };
  });

  return {
    weeksToTarget,
    expectedWeeklyChangeKg: roundToTwoDecimals((targetWeightKg - currentWeightKg) / weeksToTarget),
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

  const weightGoalError = getWeightGoalValidationError({
    goal: input.goal,
    heightCm: input.heightCm,
    currentWeightKg: input.currentWeightKg,
    targetWeightKg: input.targetWeightKg,
  });
  if (weightGoalError !== null) {
    throw new RangeError(weightGoalError);
  }

  if (input.bigDayType === "none" && input.targetDateSource === "important_date") {
    throw new RangeError("An important date is required when it is selected as the target date.");
  }

  if (input.bigDayType !== "none" && input.bigDayDate === undefined) {
    throw new RangeError("An important date is required for the selected occasion.");
  }

  if (input.targetDateSource === "important_date" && input.bigDayDate === undefined) {
    throw new RangeError("An important date is required when it is selected as the target date.");
  }
}

export function getWeightGoalValidationError(input: {
  goal: unknown;
  heightCm?: number;
  currentWeightKg: number;
  targetWeightKg: number;
}) {
  const goal = normalizeGoal(input.goal);
  if (goal === "lose_weight") {
    if (input.targetWeightKg >= input.currentWeightKg) {
      return "A weight-loss target must be lower than current weight.";
    }

    if (
      input.heightCm !== undefined &&
      calculateRawBmi(input.heightCm, input.currentWeightKg) < bmiHealthyLowerBound
    ) {
      return "A weight-loss goal is not available when BMI is below 18.5.";
    }
  }

  if (goal === "gain_weight" && input.targetWeightKg <= input.currentWeightKg) {
    return "A weight-gain target must be higher than current weight.";
  }

  if (goal === "maintain_weight" && input.targetWeightKg !== input.currentWeightKg) {
    return "A maintenance target must equal current weight.";
  }

  if (goal === "lose_weight" && input.heightCm !== undefined) {
    const range = getWeightLossTargetWeightRange(
      input.heightCm,
      input.currentWeightKg,
      calculateRawBmi(input.heightCm, input.currentWeightKg),
    );
    if (
      range === null ||
      input.targetWeightKg < range.minKg ||
      input.targetWeightKg > range.maxKg
    ) {
      return `A weight-loss target must be between ${range?.minKg ?? "a valid"} and ${range?.maxKg ?? "a valid"} kg.`;
    }
  }

  if (goal === "gain_weight" && input.heightCm !== undefined) {
    const rawBmi = calculateRawBmi(input.heightCm, input.currentWeightKg);
    const range = getWeightGainTargetWeightRange(input.heightCm, input.currentWeightKg, rawBmi);
    if (range !== null && (
      input.targetWeightKg < range.minKg ||
      input.targetWeightKg > range.maxKg
    )) {
      return `A weight-gain target must be between ${range.minKg} and ${range.maxKg} kg.`;
    }
  }

  return null;
}

function validateBmiPreviewInput(input: BmiPreviewInput) {
  if (normalizeGoal(input.goal) === null) {
    throw new RangeError("Goal is invalid.");
  }

  if (!Number.isFinite(input.heightCm) || input.heightCm < 100 || input.heightCm > 250) {
    throw new RangeError("Height must be between 100 and 250 cm.");
  }

  if (!Number.isFinite(input.currentWeightKg) || input.currentWeightKg < 30 || input.currentWeightKg > 350) {
    throw new RangeError("Current weight must be between 30 and 350 kg.");
  }
}

function parseTargetTiming(targetDateInput: string, referenceAt: Date) {
  if (!isValidIsoDate(targetDateInput)) {
    throw new RangeError("Target date must use YYYY-MM-DD format.");
  }

  const [year, month, day] = targetDateInput.split("-").map(Number);
  const targetDate = new Date(Date.UTC(year!, month! - 1, day!));
  if (targetDate.toISOString().slice(0, 10) !== targetDateInput) {
    throw new RangeError("Target date must be a real calendar date.");
  }

  const computedDate = new Date(Date.UTC(
    referenceAt.getUTCFullYear(),
    referenceAt.getUTCMonth(),
    referenceAt.getUTCDate(),
  ));
  const daysToTarget = Math.ceil((targetDate.getTime() - computedDate.getTime()) / dayMilliseconds);

  if (daysToTarget < 14) {
    throw new RangeError("Target date must be at least 14 days after the assessment date.");
  }

  if (daysToTarget > 730) {
    throw new RangeError("Target date must be within 730 days of the assessment date.");
  }

  return {
    targetDate,
    daysToTarget,
    weeksToTarget: Math.max(1, Math.ceil(daysToTarget / 7)),
  };
}

function calculateRawBmi(heightCm: number, weightKg: number) {
  return weightKg / Math.pow(heightCm / 100, 2);
}

export function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < bmiHealthyLowerBound) return "LOW";
  if (bmi < bmiHealthyUpperBound) return "NORMAL";
  if (bmi < 28) return "HIGH";
  return "VERY_HIGH";
}

function getWeightLossTargetWeightRange(
  heightCm: number,
  currentWeightKg: number,
  bmi: number,
) {
  if (bmi < bmiHealthyLowerBound) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const minimum = getHealthyMinimumWeight(heightMeters);
  const maximum = roundToOneDecimal(
    Math.min(getHealthyMaximumWeight(heightMeters), currentWeightKg - 0.1),
  );

  return maximum >= minimum && maximum >= 30
    ? { minKg: minimum, maxKg: clamp(maximum, 30, 350) }
    : null;
}

function getWeightGainTargetWeightRange(
  heightCm: number,
  currentWeightKg: number,
  bmi: number,
) {
  if (bmi >= bmiHealthyUpperBound) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const minimum = clamp(
    roundToOneDecimal(Math.max(
      bmiHealthyLowerBound * Math.pow(heightMeters, 2),
      currentWeightKg + 0.1,
    )),
    30,
    350,
  );
  const maximum = clamp(
    getHealthyMaximumWeight(heightMeters),
    30,
    350,
  );

  return maximum >= minimum ? { minKg: minimum, maxKg: maximum } : null;
}

function getHealthyMinimumWeight(heightMeters: number) {
  return clamp(
    roundToOneDecimal(bmiHealthyLowerBound * Math.pow(heightMeters, 2)),
    30,
    350,
  );
}

function getHealthyMaximumWeight(heightMeters: number) {
  return roundToOneDecimal(bmiHealthyUpperBound * Math.pow(heightMeters, 2) - 0.1);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
