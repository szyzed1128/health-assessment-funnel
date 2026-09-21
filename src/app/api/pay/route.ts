import { z } from "zod";

import { paymentService } from "@/infrastructure/application-services";
import { errorResponse, success } from "@/infrastructure/http/api-response";

const paymentSchema = z.object({ sessionId: z.uuid(), paymentEventId: z.uuid() });

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new z.ZodError([]);
    });
    const { sessionId, paymentEventId } = paymentSchema.parse(body);
    return success(await paymentService.pay(sessionId, paymentEventId));
  } catch (error) {
    return errorResponse(error);
  }
}
