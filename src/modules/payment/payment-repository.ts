export type PaymentOutcome = "SUCCEEDED" | "SESSION_NOT_FOUND" | "RESULT_MISSING" | "EVENT_CONFLICT";

export interface PaymentRepository {
  processSuccessfulPayment(sessionId: string, paymentEventId: string, processedAt: Date): Promise<PaymentOutcome>;
}
