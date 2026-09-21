import { z } from "zod";

import { subscriptionService } from "@/infrastructure/application-services";
import { errorResponse, success } from "@/infrastructure/http/api-response";

const paramsSchema = z.object({ sessionId: z.uuid() });
type ResultRouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: ResultRouteContext) {
  try {
    const { sessionId } = paramsSchema.parse(await context.params);
    return success(await subscriptionService.getVisibleResult(sessionId));
  } catch (error) {
    return errorResponse(error);
  }
}
