export const sessionStorageKey = "health-assessment-session-id";

export function readStoredSessionId(storage: Pick<Storage, "getItem">): string | null {
  return storage.getItem(sessionStorageKey);
}

export function storeSessionId(storage: Pick<Storage, "setItem">, sessionId: string) {
  storage.setItem(sessionStorageKey, sessionId);
}

export function clearStoredSessionId(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(sessionStorageKey);
}
