import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as assessSessionRoute } from "@/app/api/sessions/[sessionId]/assessment/route";
import { GET as bmiPreviewRoute } from "@/app/api/sessions/[sessionId]/bmi-preview/route";
import { assessmentService, healthService, sessionService } from "@/infrastructure/application-services";
import { prisma } from "@/infrastructure/db/prisma";
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
} as const;

describe("server-side health assessment", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.assessmentSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("calculates from persisted answers and persists a traceable result", async () => {
    const session = await sessionService.createSession();
    for (const [questionKey, value] of Object.entries(validAnswers)) {
      await assessmentService.saveAnswer(session.sessionId, questionKey, value);
    }

    const result = await healthService.assessSession(session.sessionId);
    const stored = await prisma.healthAssessmentResult.findUnique({ where: { sessionId: session.sessionId } });
    const storedSession = await prisma.assessmentSession.findUnique({ where: { id: session.sessionId } });

    expect(result).toMatchObject({ bmi: 26.57, recommendedDailyCalories: 1484 });
    expect(stored).toMatchObject({
      recommendedDailyCalories: 1484,
      algorithmVersion: "v2-goal-routing",
    });
    expect(stored?.requestedTargetDate?.toISOString().slice(0, 10)).toBe(validAnswers.bigDayDate);
    expect(stored?.targetDateSource).toBe("IMPORTANT_DATE");
    expect(stored?.forecastTargetDate?.toISOString().slice(0, 10)).toBe(validAnswers.bigDayDate);
    expect(storedSession?.status).toBe("ASSESSED");
  });

  it("does not calculate or persist a result for an incomplete assessment", async () => {
    const session = await sessionService.createSession();
    await assessmentService.saveAnswer(session.sessionId, "gender", "female");

    await expect(healthService.assessSession(session.sessionId)).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.healthAssessmentResult.count({ where: { sessionId: session.sessionId } })).toBe(0);
  });

  it("returns a server-side BMI preview after height and current weight are saved", async () => {
    const session = await sessionService.createSession();
    await assessmentService.saveAnswer(session.sessionId, "goal", "maintain_weight");
    await assessmentService.saveAnswer(session.sessionId, "heightCm", 168);
    await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 65);

    const response = await bmiPreviewRoute(
      new Request(`http://localhost/api/sessions/${session.sessionId}/bmi-preview`),
      { params: Promise.resolve({ sessionId: session.sessionId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        bmi: 23.03,
        category: "NORMAL",
        effectiveGoal: "maintain_weight",
        goalResolution: "AUTO_MAINTAIN",
        requiresConfirmation: false,
        autoFillTargetWeightKg: 65,
        recommendedTargetWeightRange: null,
      },
    });
  });

  it("keeps one result record associated with its session when recalculated", async () => {
    const session = await sessionService.createSession();
    for (const [questionKey, value] of Object.entries(validAnswers)) {
      await assessmentService.saveAnswer(session.sessionId, questionKey, value);
    }

    await healthService.assessSession(session.sessionId);
    await assessmentService.saveAnswer(session.sessionId, "currentWeightKg", 74);
    await assessmentService.saveAnswer(session.sessionId, "targetWeightKg", 65);
    const recalculated = await healthService.assessSession(session.sessionId);
    const storedSession = await prisma.assessmentSession.findUnique({
      where: { id: session.sessionId },
      include: { healthResult: true },
    });

    expect(recalculated.bmi).toBe(26.22);
    expect(storedSession?.healthResult?.sessionId).toBe(session.sessionId);
    expect(await prisma.healthAssessmentResult.count({ where: { sessionId: session.sessionId } })).toBe(1);
  });

  it("exposes assessment calculation through the API without accepting client calculations", async () => {
    const session = await sessionService.createSession();
    for (const [questionKey, value] of Object.entries(validAnswers)) {
      await assessmentService.saveAnswer(session.sessionId, questionKey, value);
    }

    const response = await assessSessionRoute(
      new Request(`http://localhost/api/sessions/${session.sessionId}/assessment`, { method: "POST" }),
      { params: Promise.resolve({ sessionId: session.sessionId }) },
    );

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ status: "ASSESSED" });
    expect(await prisma.healthAssessmentResult.findUnique({ where: { sessionId: session.sessionId } })).toMatchObject({
      recommendedDailyCalories: 1484,
    });
  });
});

function futureDateInput(daysFromNow: number) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
  return date.toISOString().slice(0, 10);
}
