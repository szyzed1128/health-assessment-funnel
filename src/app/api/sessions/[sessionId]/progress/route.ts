import { z } from "zod";

import { errorResponse, success } from "@/infrastructure/http/api-response";
import { sessionService } from "@/infrastructure/application-services";

const paramsSchema = z.object({ sessionId: z.uuid() });
type ProgressRouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: ProgressRouteContext) {
  try {
    const { sessionId } = paramsSchema.parse(await context.params);
    return success(await sessionService.getSessionProgress(sessionId));
  } catch (error) {
    return errorResponse(error);
  }
}
