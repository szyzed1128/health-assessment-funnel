import type { HealthAssessment } from "@/modules/health/health-assessment-algorithm";
import type { SessionWithAnswers } from "@/modules/session/session-repository";

export interface HealthRepository {
  findSessionWithAnswers(sessionId: string): Promise<SessionWithAnswers | null>;
  saveAssessment(sessionId: string, assessment: HealthAssessment): Promise<void>;
}
