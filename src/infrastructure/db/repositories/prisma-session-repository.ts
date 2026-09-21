import { prisma } from "@/infrastructure/db/prisma";
import type {
  PersistedSession,
  SessionRepository,
  SessionWithAnswers,
} from "@/modules/session/session-repository";

export class PrismaSessionRepository implements SessionRepository {
  async create(): Promise<PersistedSession> {
    return prisma.assessmentSession.create({ data: {} });
  }

  async findWithAnswers(sessionId: string): Promise<SessionWithAnswers | null> {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { answers: true },
    });

    if (session === null) {
      return null;
    }

    return {
      session,
      answers: session.answers.map((answer) => ({
        questionKey: answer.questionKey,
        value: answer.value,
      })),
    };
  }
}
