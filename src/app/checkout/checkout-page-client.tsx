"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { mockPaymentCode } from "@/modules/payment/mock-payment-code";
import {
  clearStoredSessionId,
  readStoredSessionId,
  storeSessionId,
} from "@/modules/session/browser-session";
import { getClientErrorMessage } from "@/shared/client-error-message";

export default function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");
  const [paymentCode, setPaymentCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionId = requestedSessionId;

  useEffect(() => {
    if (requestedSessionId !== null) {
      storeSessionId(window.localStorage, requestedSessionId);
      return;
    }

    const storedSessionId = readStoredSessionId(window.localStorage);
    if (storedSessionId !== null) {
      router.replace(`/checkout?sessionId=${storedSessionId}`);
      return;
    }
  }, [requestedSessionId, router]);

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sessionId === null) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          paymentEventId: crypto.randomUUID(),
          paymentCode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getClientErrorMessage(payload, "模拟支付失败。"));
      }

      router.push(`/result?sessionId=${sessionId}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "模拟支付失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function restartAssessment() {
    clearStoredSessionId(window.localStorage);
    router.push("/");
  }

  return (
    <main className="assessment-shell">
      <p className="eyebrow">模拟支付</p>
      <h1>解锁完整报告</h1>
      {sessionId !== null ? <p className="session-meta">当前 Session ID：<code>{sessionId}</code></p> : null}
      <p className="muted">支付成功后将解锁当前会话的完整报告。</p>
      <p className="code-hint">本地演示支付码：<code>{mockPaymentCode}</code></p>
      <form className="checkout-form" onSubmit={(event) => void submitPayment(event)}>
        <label>
          <span>支付码</span>
          <input
            autoComplete="off"
            name="paymentCode"
            onChange={(event) => setPaymentCode(event.target.value)}
            required
            type="text"
            value={paymentCode}
          />
        </label>
        <button className="primary-button" disabled={isSubmitting || sessionId === null} type="submit">
          {isSubmitting ? "正在提交..." : "确认模拟支付"}
        </button>
      </form>
      {error !== null || sessionId === null ? (
        <p className="error-message">{error ?? "缺少测评 Session ID，请先完成测评。"}</p>
      ) : null}
      <button className="secondary-button" disabled={isSubmitting} onClick={() => router.push(sessionId === null ? "/" : `/result?sessionId=${sessionId}`)} type="button">
        返回结果页
      </button>
      <button className="secondary-button" disabled={isSubmitting} onClick={restartAssessment} type="button">
        重新开始测评
      </button>
    </main>
  );
}
