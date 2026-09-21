import type { PaymentRepository } from "@/modules/payment/payment-repository";
import type { VisibleResult } from "@/modules/subscription/subscription-service";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/domain-error";

export function createPaymentService(
  repository: PaymentRepository,
  getVisibleResult: (sessionId: string) => Promise<VisibleResult>,
  now = () => new Date(),
) {
  return {
    async pay(sessionId: string, paymentEventId: string): Promise<VisibleResult> {
      const outcome = await repository.processSuccessfulPayment(sessionId, paymentEventId, now());
      if (outcome === "SESSION_NOT_FOUND") throw new NotFoundError("Assessment session was not found.");
      if (outcome === "RESULT_MISSING") throw new ValidationError("Calculate the health assessment before payment.");
      if (outcome === "EVENT_CONFLICT") throw new ConflictError("Payment event ID is already associated with another session.");
      return getVisibleResult(sessionId);
    },
  };
}
