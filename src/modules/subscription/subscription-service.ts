import type { SubscriptionRepository } from "@/modules/subscription/subscription-repository";
import { getBmiCategory } from "@/modules/health/health-assessment-algorithm";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-error";

type ResultSummary = {
  bmi: number;
  summary: string;
  targetWeightDifferenceKg: number;
};

type FreeResult = ResultSummary & {
  access: "FREE";
  upgradePrompt: string;
};

type MemberResult = ResultSummary & {
  access: "MEMBER";
  recommendedDailyCalories: number;
  targetDate: Date;
  requestedTargetDate: Date | null;
  targetDateSource: "SYSTEM" | "IMPORTANT_DATE";
  forecastTargetDate: Date;
  weeklyForecast: unknown;
  actionPlan: unknown;
};

export type VisibleResult = FreeResult | MemberResult;

export function createSubscriptionService(repository: SubscriptionRepository, now = () => new Date()) {
  return {
    async getVisibleResult(sessionId: string): Promise<VisibleResult> {
      const record = await repository.findResultAccess(sessionId);
      if (!record.sessionExists) {
        throw new NotFoundError("Assessment session was not found.");
      }
      if (record.healthResult === null) {
        throw new ValidationError("Calculate the health assessment before requesting results.");
      }

      const { healthResult } = record;
      const freeResult: FreeResult = {
        access: "FREE",
        bmi: healthResult.bmi,
        summary: summarizeBmi(healthResult.bmi),
        targetWeightDifferenceKg: record.targetWeightDifferenceKg,
        upgradePrompt: "解锁完整个性化健康报告，查看详细建议与预测数据。",
      };

      if (!hasActiveSubscription(record.subscription, now())) {
        return freeResult;
      }

      return {
        bmi: freeResult.bmi,
        summary: freeResult.summary,
        targetWeightDifferenceKg: freeResult.targetWeightDifferenceKg,
        access: "MEMBER",
        recommendedDailyCalories: healthResult.recommendedDailyCalories,
        targetDate: healthResult.targetDate,
        requestedTargetDate: healthResult.requestedTargetDate,
        targetDateSource: healthResult.targetDateSource,
        forecastTargetDate: healthResult.forecastTargetDate,
        weeklyForecast: healthResult.weeklyForecast,
        actionPlan: healthResult.actionPlan,
      };
    },
  };
}

function hasActiveSubscription(
  subscription: { status: string; startsAt: Date | null; endsAt: Date | null } | null,
  now: Date,
) {
  return subscription?.status === "ACTIVE" &&
    subscription.startsAt !== null && subscription.startsAt <= now &&
    subscription.endsAt !== null && subscription.endsAt > now;
}

function summarizeBmi(bmi: number) {
  const category = getBmiCategory(bmi);
  if (category === "LOW") return "您的 BMI 低于成人常用参考范围。";
  if (category === "NORMAL") return "您的 BMI 位于成人常用参考范围内。";
  if (category === "HIGH") return "您的 BMI 高于成人常用参考范围。";
  return "您的 BMI 明显高于成人常用参考范围。";
}
