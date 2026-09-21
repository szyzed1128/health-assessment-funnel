import { z } from "zod";

import { errorResponse, success } from "@/infrastructure/http/api-response";
import { assessmentService } from "@/infrastructure/application-services";
import { ValidationError } from "@/shared/errors/domain-error";

const paramsSchema = z.object({
  sessionId: z.uuid(),
  questionKey: z.string().min(1).max(64),
});

const bodySchema = z.object({ value: z.unknown() });
type AnswerRouteContext = {
  params: Promise<{ sessionId: string; questionKey: string }>;
};

export async function PUT(
  request: Request,
  context: AnswerRouteContext,
) {
  try {
    const { sessionId, questionKey } = paramsSchema.parse(await context.params);
    const body = await request.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON.");
    });
    const { value } = bodySchema.parse(body);
    return success(await assessmentService.saveAnswer(sessionId, questionKey, value));
  } catch (error) {
    return errorResponse(error);
  }
}
