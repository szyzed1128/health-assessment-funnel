import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as payRoute } from "@/app/api/pay/route";
import { GET as resultRoute } from "@/app/api/sessions/[sessionId]/result/route";
import { paymentService, subscriptionService } from "@/infrastructure/application-services";
import { prisma } from "@/infrastructure/db/prisma";
import { mockPaymentCode } from "@/modules/payment/mock-payment-code";

async function createAssessedSession(bmi = 26.57) {
  const session = await prisma.assessmentSession.create({ data: { status: "ASSESSED" } });
  await prisma.assessmentAnswer.createMany({
    data: [
      { sessionId: session.id, questionKey: "currentWeightKg", answerType: "NUMBER", value: 75 },
      { sessionId: session.id, questionKey: "targetWeightKg", answerType: "NUMBER", value: 65 },
    ],
  });
  await prisma.healthAssessmentResult.create({
    data: {
      sessionId: session.id,
      bmi,
      recommendedDailyCalories: 1534,
      targetDate: new Date("2026-05-21T00:00:00.000Z"),
      requestedTargetDate: new Date("2026-05-28T00:00:00.000Z"),
      targetDateSource: "IMPORTANT_DATE",
      forecastTargetDate: new Date("2026-05-28T00:00:00.000Z"),
      weeklyForecast: { weeksToTarget: 20, points: [] },
      actionPlan: { focus: "consistent activity" },
      algorithmVersion: "v1-mifflin-simple",
    },
  });
  return session;
}

describe("subscription authorization and mock payment", () => {
  beforeAll(async () => prisma.$connect());
  beforeEach(async () => prisma.assessmentSession.deleteMany());
  afterAll(async () => prisma.$disconnect());

  it("returns only an allow-listed free result through the API", async () => {
    const session = await createAssessedSession();
    const response = await resultRoute(new Request(`http://localhost/api/sessions/${session.id}/result`), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      access: "FREE",
      bmi: 26.57,
      summary: "您的 BMI 高于成人常用参考范围。",
      targetWeightDifferenceKg: -10,
      upgradePrompt: "解锁完整个性化健康报告，查看详细建议与预测数据。",
    });
    expect(body.data).not.toHaveProperty("recommendedDailyCalories");
    expect(body.data).not.toHaveProperty("targetDate");
    expect(body.data).not.toHaveProperty("requestedTargetDate");
    expect(body.data).not.toHaveProperty("targetDateSource");
    expect(body.data).not.toHaveProperty("forecastTargetDate");
    expect(body.data).not.toHaveProperty("weeklyForecast");
    expect(body.data).not.toHaveProperty("actionPlan");
  });

  it("uses the same Chinese BMI boundaries as the assessment preview", async () => {
    const highSession = await createAssessedSession(24.5);
    const highResponse = await resultRoute(
      new Request(`http://localhost/api/sessions/${highSession.id}/result`),
      { params: Promise.resolve({ sessionId: highSession.id }) },
    );
    const highBody = await highResponse.json();

    const veryHighSession = await createAssessedSession(28.5);
    const veryHighResponse = await resultRoute(
      new Request(`http://localhost/api/sessions/${veryHighSession.id}/result`),
      { params: Promise.resolve({ sessionId: veryHighSession.id }) },
    );
    const veryHighBody = await veryHighResponse.json();

    expect(highBody.data.summary).toBe("您的 BMI 高于成人常用参考范围。");
    expect(veryHighBody.data.summary).toBe("您的 BMI 明显高于成人常用参考范围。");
  });

  it("activates access after payment and keeps a repeated event idempotent", async () => {
    const session = await createAssessedSession();
    const eventId = "f77d1baa-5b45-4ccc-8ca2-2f58a046eb4f";

    const firstResult = await paymentService.pay(session.id, eventId, mockPaymentCode);
    const secondResult = await paymentService.pay(session.id, eventId, mockPaymentCode);

    expect(firstResult).toMatchObject({ access: "MEMBER", recommendedDailyCalories: 1534 });
    expect(secondResult).toMatchObject({
      access: "MEMBER",
      targetDate: new Date("2026-05-21T00:00:00.000Z"),
      requestedTargetDate: new Date("2026-05-28T00:00:00.000Z"),
      targetDateSource: "IMPORTANT_DATE",
      forecastTargetDate: new Date("2026-05-28T00:00:00.000Z"),
    });
    expect(await prisma.paymentEvent.count({ where: { sessionId: session.id } })).toBe(1);
    expect(await prisma.subscription.count({ where: { sessionId: session.id, status: "ACTIVE" } })).toBe(1);

    const postPaymentResponse = await resultRoute(
      new Request(`http://localhost/api/sessions/${session.id}/result`),
      { params: Promise.resolve({ sessionId: session.id }) },
    );
    const postPaymentBody = await postPaymentResponse.json();
    expect(postPaymentBody.data).toMatchObject({ access: "MEMBER", recommendedDailyCalories: 1534 });
    expect(postPaymentBody.data).not.toHaveProperty("upgradePrompt");
  });

  it("rejects payment before a server-side assessment and rejects event reuse across sessions", async () => {
    const incomplete = await prisma.assessmentSession.create({ data: {} });
    const eventId = "02f997b8-e01a-4cd6-863e-31b5f3cf69f6";
    await expect(paymentService.pay(incomplete.id, eventId, mockPaymentCode)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const firstSession = await createAssessedSession();
    const secondSession = await createAssessedSession();
    await paymentService.pay(firstSession.id, eventId, mockPaymentCode);
    await expect(paymentService.pay(secondSession.id, eventId, mockPaymentCode)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("validates the payment API body and only activates access with the correct payment code", async () => {
    const session = await createAssessedSession();
    const invalidResponse = await payRoute(new Request("http://localhost/api/pay", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    }));
    const rejectedResponse = await payRoute(new Request("http://localhost/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        paymentEventId: "36f863a2-5472-455f-94e6-bd5068799a88",
        paymentCode: "WRONG-CODE",
      }),
    }));

    expect(invalidResponse.status).toBe(422);
    expect(rejectedResponse.status).toBe(422);
    expect(await prisma.paymentEvent.count({ where: { sessionId: session.id } })).toBe(0);
    expect((await subscriptionService.getVisibleResult(session.id)).access).toBe("FREE");

    const response = await payRoute(new Request("http://localhost/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        paymentEventId: "4277c3c5-4d6a-45af-aea0-1eb04f94b3ce",
        paymentCode: mockPaymentCode,
      }),
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).data.access).toBe("MEMBER");
    expect((await subscriptionService.getVisibleResult(session.id)).access).toBe("MEMBER");
  });
});
