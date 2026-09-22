-- Health assessment results are only persisted after all required calculations succeed.
ALTER TABLE "HealthAssessmentResult"
  ALTER COLUMN "bmi" SET NOT NULL,
  ALTER COLUMN "recommendedDailyCalories" SET NOT NULL,
  ALTER COLUMN "targetDate" SET NOT NULL,
  ALTER COLUMN "forecastTargetDate" SET NOT NULL,
  ALTER COLUMN "weeklyForecast" SET NOT NULL;
