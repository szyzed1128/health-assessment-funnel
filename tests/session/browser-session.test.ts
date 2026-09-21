// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  clearStoredSessionId,
  readStoredSessionId,
  sessionStorageKey,
  storeSessionId,
} from "@/modules/session/browser-session";

describe("browser session persistence", () => {
  it("stores, restores, and clears the anonymous session ID", () => {
    window.localStorage.clear();

    storeSessionId(window.localStorage, "session-123");
    expect(readStoredSessionId(window.localStorage)).toBe("session-123");

    clearStoredSessionId(window.localStorage);
    expect(window.localStorage.getItem(sessionStorageKey)).toBeNull();
  });

  it("allows a new session ID to replace a cleared prior session", () => {
    window.localStorage.clear();
    storeSessionId(window.localStorage, "previous-session");
    clearStoredSessionId(window.localStorage);
    storeSessionId(window.localStorage, "new-session");

    expect(readStoredSessionId(window.localStorage)).toBe("new-session");
  });
});
