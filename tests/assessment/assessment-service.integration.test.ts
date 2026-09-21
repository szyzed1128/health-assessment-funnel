import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/db/prisma";
import { assessmentService, sessionService } from "@/infrastructure/application-services";
import { requiredQuestionKeys } from "@/modules/assessment/question-definition";
import { ValidationError } from "@/shared/errors/domain-error";

const validAnswers = {
  gender: "female",
  goal: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 75,
  targetWeightKg: 65,
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
    await assessmentService.saveAnswer(session.sessionId, "targetWeightKg", 75);
    await expect(assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(
      await prisma.assessmentAnswer.findUnique({
        where: {
          sessionId_questionKey: { sessionId: session.sessionId, questionKey: "currentWeightKg" },
        },
      }),
    ).toBeNull();
  });

  it("handles concurrent saves and reaches the ready state", async () => {
    const session = await sessionService.createSession();

    await Promise.all(
      requiredQuestionKeys.map((questionKey) =>
        assessmentService.saveAnswer(session.sessionId, questionKey, validAnswers[questionKey]),
      ),
    );

    const progress = await sessionService.getSessionProgress(session.sessionId);

    expect(progress.status).toBe("READY_FOR_ASSESSMENT");
    expect(progress.currentStep).toBe(requiredQuestionKeys.length);
    expect(progress.nextQuestionKey).toBeNull();
    expect(Object.keys(progress.answers)).toHaveLength(requiredQuestionKeys.length);
  });

  it("rejects unknown questions and invalid values before persistence", async () => {
    const session = await sessionService.createSession();

    await expect(assessmentService.saveAnswer(session.sessionId, "unknownQuestion", "value")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(assessmentService.saveAnswer(session.sessionId, "heightCm", -20)).rejects.toBeInstanceOf(ValidationError);

    expect(await prisma.assessmentAnswer.count({ where: { sessionId: session.sessionId } })).toBe(0);
  });
});
