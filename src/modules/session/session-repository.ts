export type SessionStatus = "IN_PROGRESS" | "READY_FOR_ASSESSMENT" | "ASSESSED";

export type PersistedSession = {
  id: string;
  status: SessionStatus;
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedAnswer = {
  questionKey: string;
  value: unknown;
};

export type SessionWithAnswers = {
  session: PersistedSession;
  answers: PersistedAnswer[];
};

export interface SessionRepository {
  create(): Promise<PersistedSession>;
  findWithAnswers(sessionId: string): Promise<SessionWithAnswers | null>;
}
