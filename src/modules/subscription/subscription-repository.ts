export type PersistedHealthResult = {
  bmi: number;
  recommendedDailyCalories: number;
  targetDate: Date;
  requestedTargetDate: Date | null;
  targetDateSource: "SYSTEM" | "IMPORTANT_DATE";
  forecastTargetDate: Date;
  weeklyForecast: unknown;
  actionPlan: unknown;
};

export type PersistedSubscription = {
  status: "INACTIVE" | "ACTIVE" | "EXPIRED";
  startsAt: Date | null;
  endsAt: Date | null;
};

export type ResultAccessRecord = {
  sessionExists: boolean;
  healthResult: PersistedHealthResult | null;
  subscription: PersistedSubscription | null;
  targetWeightDifferenceKg: number;
};

export interface SubscriptionRepository {
  findResultAccess(sessionId: string): Promise<ResultAccessRecord>;
}
