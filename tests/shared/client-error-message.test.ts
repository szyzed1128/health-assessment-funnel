import { describe, expect, it } from "vitest";

import { getClientErrorMessage } from "@/shared/client-error-message";

describe("getClientErrorMessage", () => {
  it("uses a Chinese message mapped from a stable API error code", () => {
    expect(getClientErrorMessage({ error: { code: "NOT_FOUND", message: "Assessment session was not found." } }, "操作失败")).toBe(
      "测评会话不存在或已失效，请重新开始。",
    );
  });

  it("uses the caller fallback for an unknown payload", () => {
    expect(getClientErrorMessage({ error: { code: "UNKNOWN" } }, "无法保存答案。")).toBe("无法保存答案。");
  });
});
