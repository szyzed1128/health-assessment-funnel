import { z } from "zod";

import { healthService } from "@/infrastructure/application-services";
import { errorResponse, success } from "@/infrastructure/http/api-response";

const paramsSchema = z.object({ sessionId: z.uuid() });
type BmiPreviewRouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: BmiPreviewRouteContext) {
  try {
    const { sessionId } = paramsSchema.parse(await context.params);
    return success(await healthService.getBmiPreview(sessionId));
  } catch (error) {
    return errorResponse(error);
  }
}
