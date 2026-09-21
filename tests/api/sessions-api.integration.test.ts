import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PUT as saveAnswerRoute } from "@/app/api/sessions/[sessionId]/answers/[questionKey]/route";
import { GET as progressRoute } from "@/app/api/sessions/[sessionId]/progress/route";
import { POST as createSessionRoute } from "@/app/api/sessions/route";
import { prisma } from "@/infrastructure/db/prisma";

const validSessionId = "d20d942b-4ad9-4318-a388-74304443f2db";

describe("session API", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.assessmentSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a session and exposes the initial progress contract", async () => {
    const response = await createSessionRoute();
    const body = (await response.json()) as { data: { sessionId: string; currentStep: number } };

    expect(response.status).toBe(201);
    expect(body.data.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.currentStep).toBe(0);
  });

  it("saves one answer and returns persisted progress", async () => {
    const created = await createSessionRoute();
    const { data: session } = (await created.json()) as { data: { sessionId: string } };

    const saveResponse = await saveAnswerRoute(
      new Request(`http://localhost/api/sessions/${session.sessionId}/answers/age`, {
        method: "PUT",
        body: JSON.stringify({ value: 32 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ sessionId: session.sessionId, questionKey: "age" }) },
    );
    const progressResponse = await progressRoute(
      new Request(`http://localhost/api/sessions/${session.sessionId}/progress`),
      { params: Promise.resolve({ sessionId: session.sessionId }) },
    );

    expect(saveResponse.status).toBe(200);
    expect(progressResponse.status).toBe(200);
    expect((await progressResponse.json()).data.answers).toMatchObject({ age: 32 });
  });

  it("returns 422 for invalid request data without writing an answer", async () => {
    await prisma.assessmentSession.create({ data: { id: validSessionId } });

    const response = await saveAnswerRoute(
      new Request(`http://localhost/api/sessions/${validSessionId}/answers/heightCm`, {
        method: "PUT",
        body: JSON.stringify({ value: -20 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ sessionId: validSessionId, questionKey: "heightCm" }) },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid value for heightCm." },
    });
    expect(await prisma.assessmentAnswer.count({ where: { sessionId: validSessionId } })).toBe(0);
  });

  it("returns 422 for malformed JSON without writing an answer", async () => {
    await prisma.assessmentSession.create({ data: { id: validSessionId } });

    const response = await saveAnswerRoute(
      new Request(`http://localhost/api/sessions/${validSessionId}/answers/heightCm`, {
        method: "PUT",
        body: "{ invalid-json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ sessionId: validSessionId, questionKey: "heightCm" }) },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
    });
    expect(await prisma.assessmentAnswer.count({ where: { sessionId: validSessionId } })).toBe(0);
  });

  it("returns 404 for a well-formed but unknown session", async () => {
    const response = await progressRoute(
      new Request(`http://localhost/api/sessions/${validSessionId}/progress`),
      { params: Promise.resolve({ sessionId: validSessionId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Assessment session was not found." },
    });
  });

  it("invalidates the stored result when an assessed session answer changes", async () => {
    await prisma.assessmentSession.create({
      data: {
        id: validSessionId,
        status: "ASSESSED",
        answers: {
          create: [
            { questionKey: "gender", answerType: "SINGLE_SELECT", value: "female" },
            { questionKey: "goal", answerType: "SINGLE_SELECT", value: "lose_weight" },
            { questionKey: "age", answerType: "NUMBER", value: 32 },
            { questionKey: "heightCm", answerType: "NUMBER", value: 168 },
            { questionKey: "currentWeightKg", answerType: "NUMBER", value: 75 },
            { questionKey: "targetWeightKg", answerType: "NUMBER", value: 65 },
            { questionKey: "bigDayType", answerType: "SINGLE_SELECT", value: "wedding" },
            { questionKey: "bigDayDate", answerType: "DATE", value: futureDateInput(140) },
            { questionKey: "targetDateSource", answerType: "SINGLE_SELECT", value: "important_date" },
            { questionKey: "exerciseFrequency", answerType: "SINGLE_SELECT", value: "one_to_two_times_weekly" },
          ],
        },
        healthResult: {
          create: {
            bmi: 26.57,
            recommendedDailyCalories: 1534,
            targetDate: new Date("2026-05-21T00:00:00.000Z"),
            targetDateSource: "SYSTEM",
            forecastTargetDate: new Date("2026-05-21T00:00:00.000Z"),
            weeklyForecast: { weeksToTarget: 20, points: [] },
            algorithmVersion: "v1-mifflin-simple",
          },
        },
      },
    });

    const response = await saveAnswerRoute(
      new Request(`http://localhost/api/sessions/${validSessionId}/answers/age`, {
        method: "PUT",
        body: JSON.stringify({ value: 33 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ sessionId: validSessionId, questionKey: "age" }) },
    );

    expect(response.status).toBe(200);
    expect(await prisma.assessmentAnswer.findUniqueOrThrow({
      where: { sessionId_questionKey: { sessionId: validSessionId, questionKey: "age" } },
    })).toMatchObject({
      value: 33,
    });
    expect(await prisma.healthAssessmentResult.findUnique({ where: { sessionId: validSessionId } })).toBeNull();
    expect(await prisma.assessmentSession.findUniqueOrThrow({ where: { id: validSessionId } })).toMatchObject({
      status: "READY_FOR_ASSESSMENT",
    });
  });
});

function futureDateInput(daysFromNow: number) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
  return date.toISOString().slice(0, 10);
}
