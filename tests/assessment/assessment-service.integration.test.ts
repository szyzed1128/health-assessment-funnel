import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/db/prisma";
import { assessmentService, sessionService } from "@/infrastructure/application-services";
import { getRequiredQuestionKeys } from "@/modules/assessment/question-definition";
import { getTargetDateBounds } from "@/shared/date-utils";
import { ValidationError } from "@/shared/errors/domain-error";

const validAnswers = {
  gender: "female",
  goal: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 75,
  targetWeightKg: 65,
  bigDayType: "wedding",
  bigDayDate: futureDateInput(140),
  targetDateSource: "important_date",
  exerciseFrequency: "one_to_two_times_weekly",
  targetAreas: ["belly"],
} as const;

describe("assessment persistence", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.assessmentSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists every submitted answer and restores progress after interruption", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "gender", validAnswers.gender);
    await assessmentService.saveAnswer(session.sessionId, "goal", validAnswers.goal);

    const restored = await sessionService.getSessionProgress(session.sessionId);

    expect(restored.answers).toEqual({ gender: "female", goal: "lose_weight" });
    expect(restored.currentStep).toBe(2);
    expect(restored.nextQuestionKey).toBe("age");
    expect(restored.status).toBe("IN_PROGRESS");
  });

  it("overwrites a repeated answer without creating a duplicate row", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "age", 30);
    await assessmentService.saveAnswer(session.sessionId, "age", 31);

    const answers = await prisma.assessmentAnswer.findMany({
      where: { sessionId: session.sessionId, questionKey: "age" },
    });

    expect(answers).toHaveLength(1);
    expect(answers[0]?.value).toBe(31);
  });

  it("keeps the next step at the earliest missing question for out-of-order submission", async () => {
    const session = await sessionService.createSession();

    const progress = await assessmentService.saveAnswer(session.sessionId, "targetWeightKg", validAnswers.targetWeightKg);

    expect(progress.currentStep).toBe(0);
    expect(progress.nextQuestionKey).toBe("gender");
  });

  it("stores an optional multi-select answer as a single typed answer record", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "targetAreas", ["belly", "arms"]);

    const answer = await prisma.assessmentAnswer.findUnique({
      where: {
        sessionId_questionKey: { sessionId: session.sessionId, questionKey: "targetAreas" },
      },
    });

    expect(answer?.answerType).toBe("MULTI_SELECT");
    expect(answer?.value).toEqual(["belly", "arms"]);
  });

  it("rejects a duplicate multi-select value", async () => {
    const session = await sessionService.createSession();

    await expect(
      assessmentService.saveAnswer(session.sessionId, "targetAreas", ["belly", "belly"]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a weight-loss target that is not below the current weight", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "goal", "lose_weight");
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65);
    await expect(assessmentService.saveAnswer(session.sessionId, "targetWeightKg", 75)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "targetWeightKg" },
        },
      }),
    ).toBeNull();
  });

  it("rejects weight loss when the saved BMI is below the healthy range", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "goal", "lose_weight");
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 50);

    await expect(
      assessmentService.saveAnswer(session.sessionId, "targetWeightKg", 45),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "targetWeightKg" },
        },
      }),
    ).toBeNull();
  });

  it("rejects a weight-gain target that is not above the current weight", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "goal", "improve_fitness");
    await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 50);

    await expect(
      assessmentService.saveAnswer(session.sessionId, "targetWeightKg", 45),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("handles concurrent saves and reaches the ready state", async () => {
    const session = await sessionService.createSession();

    const requiredKeys = getRequiredQuestionKeys(validAnswers);
    await Promise.all(
      requiredKeys.map((questionKey) =>
        assessmentService.saveAnswer(
          session.sessionId,
          questionKey,
          validAnswers[questionKey as keyof typeof validAnswers],
        ),
      ),
    );

    const progress = await sessionService.getSessionProgress(session.sessionId);

    expect(progress.status).toBe("READY_FOR_ASSESSMENT");
    expect(progress.currentStep).toBe(requiredKeys.length);
    expect(progress.nextQuestionKey).toBeNull();
    expect(Object.keys(progress.answers)).toEqual(expect.arrayContaining([
      ...requiredKeys,
      "effectiveGoal",
      "goalResolution",
    ]));
  });

  it("skips the important date when the user has no important occasion", async () => {
    const session = await sessionService.createSession();
    const answers = {
      ...validAnswers,
      bigDayType: "none",
      bigDayDate: undefined,
      targetDateSource: "system",
    } as const;

    for (const [questionKey, value] of Object.entries(answers)) {
      if (value !== undefined) {
        await assessmentService.saveAnswer(session.sessionId, questionKey, value);
      }
    }

    const progress = await sessionService.getSessionProgress(session.sessionId);
    expect(progress.status).toBe("READY_FOR_ASSESSMENT");
    expect(progress.answers).not.toHaveProperty("bigDayDate");
  });

  it("rejects unknown questions and invalid values before persistence", async () => {
    const session = await sessionService.createSession();

    await expect(assessmentService.saveAnswer(session.sessionId, "unknownQuestion", "value")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(assessmentService.saveAnswer(session.sessionId, "heightCm", -20)).rejects.toBeInstanceOf(ValidationError);

    expect(await prisma.assessmentAnswer.count({ where: { sessionId: session.sessionId } })).toBe(0);
  });

  it("persists the maintenance target and skips the target-weight question when BMI is normal", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "gender", "female");
    await assessmentService.saveAnswer(session.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(session.sessionId, "age", 32);
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    const progress = await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65);

    expect(progress.answers.targetWeightKg).toBe(65);
    expect(progress.nextQuestionKey).toBe("bigDayType");
    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "targetWeightKg" },
        },
      }),
    ).toMatchObject({ answerType: "NUMBER", value: 65 });
  });

  it("keeps a decimal maintenance weight exactly equal to the current weight", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    const progress = await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65.04);

    expect(progress.answers.targetWeightKg).toBe(65.04);
    await expect(
      assessmentService.saveAnswer(session.sessionId, "bigDayType", "none"),
    ).resolves.toMatchObject({ answers: { targetWeightKg: 65.04 } });
  });

  it("persists a BMI redirect and requires confirmation before the target weight", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "gender", "female");
    await assessmentService.saveAnswer(session.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(session.sessionId, "age", 32);
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    const redirected = await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 75);

    expect(redirected.answers.effectiveGoal).toBe("lose_weight");
    expect(redirected.answers.goalResolution).toBe("REDIRECT_TO_LOSS");
    expect(redirected.answers.targetWeightKg).toBeUndefined();
    expect(redirected.nextQuestionKey).toBe("goalResolutionConfirmed");

    const confirmed = await assessmentService.saveAnswer(
      session.sessionId,
      "goalResolutionConfirmed",
      "confirmed",
    );

    expect(confirmed.answers.goalResolutionConfirmed).toBe("confirmed");
    expect(confirmed.nextQuestionKey).toBe("targetWeightKg");
  });

  it("routes low-BMI maintenance to gain weight and blocks direct low-BMI loss", async () => {
    const maintenanceSession = await sessionService.createSession();
    await assessmentService.saveAnswer(maintenanceSession.sessionId, "gender", "female");
    await assessmentService.saveAnswer(maintenanceSession.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(maintenanceSession.sessionId, "age", 32);
    await assessmentService.saveAnswer(maintenanceSession.sessionId, "heightCm", 168);
    const maintenanceProgress = await assessmentService.saveAnswer(
      maintenanceSession.sessionId,
      "currentWeightKg",
      50,
    );

    expect(maintenanceProgress.answers.effectiveGoal).toBe("gain_weight");
    expect(maintenanceProgress.answers.goalResolution).toBe("REDIRECT_TO_GAIN");
    expect(maintenanceProgress.nextQuestionKey).toBe("goalResolutionConfirmed");

    const lossSession = await sessionService.createSession();
    await assessmentService.saveAnswer(lossSession.sessionId, "gender", "female");
    await assessmentService.saveAnswer(lossSession.sessionId, "goal", "lose_weight");
    await assessmentService.saveAnswer(lossSession.sessionId, "age", 32);
    await assessmentService.saveAnswer(lossSession.sessionId, "heightCm", 168);
    const lossProgress = await assessmentService.saveAnswer(lossSession.sessionId, "currentWeightKg", 50);

    expect(lossProgress.answers.goalResolution).toBe("BLOCKED_LOSS");
    expect(lossProgress.nextQuestionKey).toBe("goalResolutionConfirmed");
    await assessmentService.saveAnswer(lossSession.sessionId, "goalResolutionConfirmed", "confirmed");
    await expect(
      assessmentService.saveAnswer(lossSession.sessionId, "targetWeightKg", 49),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refreshes a derived maintenance target when the BMI inputs change", async () => {
    const session = await sessionService.createSession();

    await assessmentService.saveAnswer(session.sessionId, "gender", "female");
    await assessmentService.saveAnswer(session.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(session.sessionId, "age", 32);
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    const first = await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65);
    expect(first.answers.targetWeightKg).toBe(65);

    const changed = await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 66);
    expect(changed.answers.targetWeightKg).toBe(66);
    expect(changed.answers.effectiveGoal).toBe("maintain_weight");
    expect(changed.answers.goalResolution).toBe("AUTO_MAINTAIN");
    expect(changed.nextQuestionKey).toBe("bigDayType");
  });

  it("rejects impossible calendar dates before persistence", async () => {
    const session = await sessionService.createSession();

    await expect(
      assessmentService.saveAnswer(session.sessionId, "bigDayDate", "2026-02-31"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "bigDayDate" },
        },
      }),
    ).toBeNull();
  });

  it("rejects an important date outside the live target window before persistence", async () => {
    const session = await sessionService.createSession();
    const bounds = getTargetDateBounds(new Date());
    const beforeMinimum = new Date(`${bounds.min}T00:00:00.000Z`);
    beforeMinimum.setUTCDate(beforeMinimum.getUTCDate() - 1);
    const value = beforeMinimum.toISOString().slice(0, 10);

    await expect(
      assessmentService.saveAnswer(session.sessionId, "bigDayDate", value),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "bigDayDate" },
        },
      }),
    ).toBeNull();
  });
});

function futureDateInput(daysFromNow: number) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
  return date.toISOString().slice(0, 10);
}
