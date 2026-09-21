import { z } from "zod";

import { healthService } from "@/infrastructure/application-services";
import { errorResponse, success } from "@/infrastructure/http/api-response";

const paramsSchema = z.object({ sessionId: z.uuid() });
type AssessmentRouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(_request: Request, context: AssessmentRouteContext) {
  try {
    const { sessionId } = paramsSchema.parse(await context.params);
    await healthService.assessSession(sessionId);
    return success({ status: "ASSESSED" }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
