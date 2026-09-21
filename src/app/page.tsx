"use client";

import { useCallback, useEffect, useState } from "react";

import {
  clearStoredSessionId,
  readStoredSessionId,
  storeSessionId,
} from "@/modules/session/browser-session";
import { getClientErrorMessage } from "@/shared/client-error-message";

type Progress = {
  sessionId: string;
  status: string;
  currentStep: number;
  nextQuestionKey: string | null;
  answers: Record<string, unknown>;
};

type Question = {
  key: Exclude<Progress["nextQuestionKey"], null>;
  title: string;
  type: "select" | "number";
  options?: Array<{ label: string; value: string }>;
  unit?: string;
};

type VisibleResult = {
  access: "FREE" | "MEMBER";
  bmi: number;
  summary: string;
  targetWeightDifferenceKg: number;
  upgradePrompt?: string;
  recommendedDailyCalories?: number;
  targetDate?: string;
  weeklyForecast?: {
    weeksToTarget: number;
    expectedWeeklyChangeKg: number;
    points: Array<{ week: number; projectedWeightKg: number }>;
  };
  actionPlan?: unknown;
};

const questions: Question[] = [
  {
    key: "gender",
    title: "请选择您的性别",
    type: "select",
    options: [
      { label: "女性", value: "female" },
      { label: "男性", value: "male" },
      { label: "非二元性别", value: "non_binary" },
      { label: "不方便透露", value: "prefer_not_to_say" },
    ],
  },
  {
    key: "goal",
    title: "您的主要目标是什么？",
    type: "select",
    options: [
      { label: "减重", value: "lose_weight" },
      { label: "保持体重", value: "maintain_weight" },
      { label: "提升体能", value: "improve_fitness" },
    ],
  },
  { key: "age", title: "您的年龄是多少？", type: "number", unit: "岁" },
  { key: "heightCm", title: "您的身高是多少？", type: "number", unit: "厘米" },
  { key: "currentWeightKg", title: "您目前的体重是多少？", type: "number", unit: "千克" },
  { key: "targetWeightKg", title: "您的目标体重是多少？", type: "number", unit: "千克" },
  {
    key: "exerciseFrequency",
    title: "您多久运动一次？",
    type: "select",
    options: [
      { label: "从不运动", value: "never" },
      { label: "每周 1-2 次", value: "one_to_two_times_weekly" },
      { label: "每周 3-4 次", value: "three_to_four_times_weekly" },
      { label: "每周 5 次以上", value: "five_plus_times_weekly" },
    ],
  },
];

export default function HomePage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<VisibleResult | null>(null);

  const requestProgress = useCallback(async (sessionId: string): Promise<Progress | null> => {
    const response = await fetch(`/api/sessions/${sessionId}/progress`);
    if (response.status === 404) {
      return null;
    }

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(getClientErrorMessage(payload, "无法恢复您的测评进度。"));
    }

    return payload.data;
  }, []);

  const initializeSession = useCallback(async () => {
    try {
      const storedSessionId = readStoredSessionId(window.localStorage);
      if (storedSessionId !== null) {
        const restored = await requestProgress(storedSessionId);
        if (restored !== null) {
          setProgress(restored);
          if (restored.status === "ASSESSED") {
            const resultResponse = await fetch(`/api/sessions/${restored.sessionId}/result`);
            const resultPayload = await resultResponse.json();
            if (!resultResponse.ok) {
              throw new Error(getClientErrorMessage(resultPayload, "无法恢复您的测评结果。"));
            }
            setResult(resultPayload.data);
          }
          return;
        }
        clearStoredSessionId(window.localStorage);
      }

      const response = await fetch("/api/sessions", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getClientErrorMessage(payload, "无法创建测评会话。"));
      }

      storeSessionId(window.localStorage, payload.data.sessionId);
      setProgress(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法开始测评。");
    }
  }, [requestProgress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initializeSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initializeSession]);

  const currentQuestion = questions.find((question) => question.key === progress?.nextQuestionKey);
  const currentValue = currentQuestion === undefined ? undefined : progress?.answers[currentQuestion.key];

  async function saveAnswer(value: string | number) {
    if (progress === null || currentQuestion === undefined) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/sessions/${progress.sessionId}/answers/${currentQuestion.key}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getClientErrorMessage(payload, "无法保存答案。"));
      }

      setProgress(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法保存答案。");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadResult(sessionId: string) {
    const response = await fetch(`/api/sessions/${sessionId}/result`);
    const payload = await response.json();
    if (!response.ok) throw new Error(getClientErrorMessage(payload, "无法加载测评结果。"));
    setResult(payload.data);
  }

  async function completeAssessment() {
    if (progress === null) return;
    setIsSaving(true);
    setError(null);
    try {
      const assessResponse = await fetch(`/api/sessions/${progress.sessionId}/assessment`, { method: "POST" });
      const assessPayload = await assessResponse.json();
      if (!assessResponse.ok) throw new Error(getClientErrorMessage(assessPayload, "无法计算测评结果。"));
      await loadResult(progress.sessionId);
      setProgress({ ...progress, status: "ASSESSED" });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法计算测评结果。");
    } finally {
      setIsSaving(false);
    }
  }

  async function payForFullReport() {
    if (progress === null) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: progress.sessionId, paymentEventId: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getClientErrorMessage(payload, "无法解锁完整报告。"));
      await loadResult(progress.sessionId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法解锁完整报告。");
    } finally {
      setIsSaving(false);
    }
  }

  async function restartAssessment() {
    if (!window.confirm("重新开始后将创建一份新的测评记录，当前页面将不再显示原测评。确定继续吗？")) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      clearStoredSessionId(window.localStorage);
      setResult(null);
      setProgress(null);

      const response = await fetch("/api/sessions", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getClientErrorMessage(payload, "无法创建新的测评会话。"));
      }

      storeSessionId(window.localStorage, payload.data.sessionId);
      setProgress(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "无法重新开始测评。");
    } finally {
      setIsSaving(false);
    }
  }

  if (error !== null && progress === null) {
    return <main className="assessment-shell"><p className="error-message">{error}</p></main>;
  }

  if (progress === null) {
    return <main className="assessment-shell"><p className="muted">正在准备您的测评...</p></main>;
  }

  if (progress.status === "READY_FOR_ASSESSMENT") {
    return (
      <main className="assessment-shell">
        <p className="eyebrow">测评已完成</p>
        <h1>您的健康档案已生成</h1>
        <p className="muted">查看由服务端计算的测评结果。</p>
        <button className="primary-button" disabled={isSaving} onClick={() => void completeAssessment()} type="button">
          {isSaving ? "正在计算..." : "查看我的结果"}
        </button>
        {error !== null ? <p className="error-message">{error}</p> : null}
      </main>
    );
  }

  if (result !== null) {
    return (
      <main className="assessment-shell">
        <p className="eyebrow">您的健康测评</p>
        <h1>{result.access === "MEMBER" ? "您的完整报告" : "您的免费结果"}</h1>
        <div className="result-summary">
          <p><strong>BMI 指数</strong><span>{result.bmi}</span></p>
          <p><strong>结果摘要</strong><span>{result.summary}</span></p>
          <p><strong>目标体重差</strong><span>{result.targetWeightDifferenceKg} 千克</span></p>
        </div>
        {result.access === "FREE" ? (
          <>
            <p className="muted">{result.upgradePrompt}</p>
            <button className="primary-button" disabled={isSaving} onClick={() => void payForFullReport()} type="button">
              {isSaving ? "正在解锁..." : "解锁完整报告"}
            </button>
          </>
        ) : (
          <div className="result-details">
            <p><strong>每日建议摄入</strong><span>{result.recommendedDailyCalories} 千卡</span></p>
            <p><strong>目标日期</strong><span>{result.targetDate ? new Date(result.targetDate).toLocaleDateString("zh-CN") : "-"}</span></p>
            <p><strong>预计周期</strong><span>{result.weeklyForecast?.weeksToTarget ?? "-"} 周</span></p>
            {result.weeklyForecast !== undefined ? <ForecastChart forecast={result.weeklyForecast} /> : null}
          </div>
        )}
        <button className="secondary-button" disabled={isSaving} onClick={() => void restartAssessment()} type="button">
          重新开始测评
        </button>
        {error !== null ? <p className="error-message">{error}</p> : null}
      </main>
    );
  }

  if (currentQuestion === undefined) {
    return <main className="assessment-shell"><p className="muted">正在准备您的结果...</p></main>;
  }

  return (
    <main className="assessment-shell">
      <p className="eyebrow">个人健康测评</p>
      <div className="progress-track" aria-label="测评进度">
        <span style={{ width: `${((progress.currentStep + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="step-label">第 {progress.currentStep + 1} 步，共 {questions.length} 步</p>
      <h1>{currentQuestion.title}</h1>
      {currentQuestion.type === "select" ? (
        <div className="answer-list">
          {currentQuestion.options?.map((option) => (
            <button
              className="answer-button"
              disabled={isSaving}
              key={option.value}
              onClick={() => void saveAnswer(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="number-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("value");
            if (typeof value === "string" && value !== "") {
              void saveAnswer(Number(value));
            }
          }}
        >
          <label>
            <span>{currentQuestion.unit}</span>
            <input
              defaultValue={typeof currentValue === "number" ? currentValue : ""}
              inputMode="decimal"
              min="0"
              name="value"
              required
              step="0.1"
              type="number"
            />
          </label>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "正在保存..." : "继续"}
          </button>
        </form>
      )}
      {error !== null ? <p className="error-message">{error}</p> : null}
    </main>
  );
}

function ForecastChart({ forecast }: { forecast: NonNullable<VisibleResult["weeklyForecast"]> }) {
  const points = forecast.points;
  if (points.length === 0) return null;

  const width = 360;
  const height = 164;
  const padding = 20;
  const weights = points.map((point) => point.projectedWeightKg);
  const minimumWeight = Math.min(...weights);
  const maximumWeight = Math.max(...weights);
  const range = Math.max(maximumWeight - minimumWeight, 1);
  const polyline = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = padding + ((maximumWeight - point.projectedWeightKg) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <section aria-label="体重预测趋势" className="forecast-chart">
      <div className="forecast-heading">
        <strong>体重预测趋势</strong>
        <span>每周预计变化 {Math.abs(forecast.expectedWeeklyChangeKg)} 千克</span>
      </div>
      <svg aria-hidden="true" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <polyline points={polyline} />
        {points.map((point, index) => {
          const [x, y] = polyline.split(" ")[index]!.split(",");
          return <circle cx={x} cy={y} key={point.week} r="3" />;
        })}
      </svg>
      <div className="forecast-labels">
        <span>第 {points[0]!.week} 周 · {points[0]!.projectedWeightKg} 千克</span>
        <span>第 {points.at(-1)!.week} 周 · {points.at(-1)!.projectedWeightKg} 千克</span>
      </div>
    </section>
  );
}
