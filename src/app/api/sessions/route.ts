import { errorResponse, success } from "@/infrastructure/http/api-response";
import { sessionService } from "@/infrastructure/application-services";

export async function POST() {
  try {
    return success(await sessionService.createSession(), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
