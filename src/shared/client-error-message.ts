const messageByCode: Record<string, string> = {
  CONFLICT: "当前操作与测评状态冲突，请重新开始后再试。",
  INTERNAL_ERROR: "服务暂时不可用，请稍后重试。",
  NOT_FOUND: "测评会话不存在或已失效，请重新开始。",
  VALIDATION_ERROR: "请输入有效的测评数据。",
};

export function getClientErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    typeof payload.error.code === "string"
  ) {
    return messageByCode[payload.error.code] ?? fallback;
  }

  return fallback;
}
