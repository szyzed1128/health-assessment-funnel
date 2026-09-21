"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ResultReport, type VisibleResult } from "@/app/_components/result-report";
import {
  clearStoredSessionId,
  readStoredSessionId,
  storeSessionId,
} from "@/modules/session/browser-session";
import { getClientErrorMessage } from "@/shared/client-error-message";

export default function ResultPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");
  const [loadState, setLoadState] = useState<
    { status: "loading" } |
    { status: "loaded"; result: VisibleResult } |
    { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    if (requestedSessionId === null) {
      const storedSessionId = readStoredSessionId(window.localStorage);
      if (storedSessionId !== null) {
        router.replace(`/result?sessionId=${storedSessionId}`);
      }
      return;
    }

    storeSessionId(window.localStorage, requestedSessionId);

    let isActive = true;
    async function loadResult() {
      setLoadState({ status: "loading" });
      try {
        const response = await fetch(`/api/sessions/${requestedSessionId}/result`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(getClientErrorMessage(payload, "无法加载测评结果。"));
        }
        if (!isActive) return;
        setLoadState({ status: "loaded", result: payload.data });
      } catch (caughtError) {
        if (!isActive) return;
        setLoadState({
          status: "error",
          message: caughtError instanceof Error ? caughtError.message : "无法加载测评结果。",
        });
      }
    }

    void loadResult();

    return () => {
      isActive = false;
    };
  }, [requestedSessionId, router]);

  function restartAssessment() {
    if (!window.confirm("重新开始后将创建一份新的测评记录，当前页面将不再显示原测评。确定继续吗？")) return;
    clearStoredSessionId(window.localStorage);
    router.push("/");
  }

  if (requestedSessionId === null) {
    return (
      <main className="assessment-shell">
        <p className="eyebrow">测评结果</p>
        <h1>暂时无法显示结果</h1>
        <p className="error-message">缺少测评 Session ID，请先完成测评。</p>
        <button className="primary-button" onClick={restartAssessment} type="button">
          重新开始测评
        </button>
      </main>
    );
  }

  if (loadState.status === "loading") {
    return <main className="assessment-shell"><p className="muted">正在加载测评结果...</p></main>;
  }

  if (loadState.status === "error") {
    return (
      <main className="assessment-shell">
        <p className="eyebrow">测评结果</p>
        <h1>暂时无法显示结果</h1>
        <p className="error-message">{loadState.message}</p>
        <button className="primary-button" onClick={restartAssessment} type="button">
          重新开始测评
        </button>
      </main>
    );
  }

  return (
    <ResultReport
      result={loadState.result}
      sessionId={requestedSessionId}
      onRestart={restartAssessment}
      onUnlock={() => router.push(`/checkout?sessionId=${requestedSessionId}`)}
    />
  );
}
