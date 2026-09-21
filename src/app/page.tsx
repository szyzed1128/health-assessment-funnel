"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearStoredSessionId,
  readStoredSessionId,
  storeSessionId,
} from "@/modules/session/browser-session";
import { getClientErrorMessage } from "@/shared/client-error-message";
import {
  formatIsoDate,
  getTargetDateBounds,
  parseIsoDate,
} from "@/shared/date-utils";

type Progress = {
  sessionId: string;
  status: string;
  currentStep: number;
  nextQuestionKey: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
};

type Question = {
  key: Exclude<Progress["nextQuestionKey"], null>;
  title: string;
  type: "select" | "number" | "date" | "notice";
  options?: Array<{ label: string; value: string }>;
  unit?: string;
  helperText?: string;
  min?: number;
  max?: number;
};

type BmiPreview = {
  bmi: number;
  category: "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
  effectiveGoal: "lose_weight" | "maintain_weight" | "gain_weight";
  goalResolution: "DIRECT" | "AUTO_MAINTAIN" | "REDIRECT_TO_GAIN" | "REDIRECT_TO_LOSS" | "BLOCKED_LOSS";
  requiresConfirmation: boolean;
  autoFillTargetWeightKg: number | null;
  recommendedTargetWeightRange: {
    minKg: number;
    maxKg: number;
  } | null;
};

type VisibleResult = {
  access: "FREE" | "MEMBER";
  bmi: number;
  summary: string;
  targetWeightDifferenceKg: number;
  upgradePrompt?: string;
  recommendedDailyCalories?: number;
  targetDate?: string;
  requestedTargetDate?: string | null;
  targetDateSource?: "SYSTEM" | "IMPORTANT_DATE";
  forecastTargetDate?: string;
  weeklyForecast?: {
    weeksToTarget: number;
    expectedWeeklyChangeKg: number;
    points: Array<{ week: number; projectedWeightKg: number }>;
  };
  actionPlan?: unknown;
};

const baseQuestions: Question[] = [
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
      { label: "增重", value: "gain_weight" },
    ],
  },
  { key: "age", title: "您的年龄是多少？", type: "number", unit: "岁", helperText: "可输入 18-100", min: 18, max: 100 },
  { key: "heightCm", title: "您的身高是多少？", type: "number", unit: "厘米", helperText: "可输入 100-250", min: 100, max: 250 },
  { key: "currentWeightKg", title: "您目前的体重是多少？", type: "number", unit: "千克", helperText: "可输入 30-350", min: 30, max: 350 },
  {
    key: "goalResolutionConfirmed",
    title: "根据 BMI 调整目标",
    type: "notice",
  },
  { key: "targetWeightKg", title: "您的目标体重是多少？", type: "number", unit: "千克", helperText: "可输入 30-350", min: 30, max: 350 },
  {
    key: "bigDayType",
    title: "最近是否有重要日期？",
    type: "select",
    options: [
      { label: "没有重要日期", value: "none" },
      { label: "生日", value: "birthday" },
      { label: "面试", value: "interview" },
      { label: "婚礼", value: "wedding" },
      { label: "旅行", value: "travel" },
      { label: "毕业或答辩", value: "graduation" },
      { label: "家庭或朋友聚会", value: "family_event" },
      { label: "其他", value: "other" },
    ],
  },
  {
    key: "bigDayDate",
    title: "重要日期是哪一天？",
    type: "date",
    helperText: "日期范围：测评日起 14 天至 2 年内",
  },
  {
    key: "targetDateSource",
    title: "你希望按哪一天作为目标参考？",
    type: "select",
    options: [
      { label: "使用系统预计日期", value: "system" },
      { label: "使用我的重要日期", value: "important_date" },
    ],
  },
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
  const [bmiPreview, setBmiPreview] = useState<BmiPreview | null>(null);
  const [bmiPreviewError, setBmiPreviewError] = useState<string | null>(null);
  const bmiPreviewRequestRef = useRef(0);

  const requestProgress = useCallback(async (sessionId: string): Promise<Progress | null> => {
    const response = await fetch(`/api/sessions/${sessionId}/progress`);
    if (response.status === 404) return null;

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(getClientErrorMessage(payload, "无法恢复您的测评进度。"));
    }

    return payload.data;
  }, []);

  const requestBmiPreview = useCallback(async (sessionId: string): Promise<BmiPreview> => {
    const response = await fetch(`/api/sessions/${sessionId}/bmi-preview`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(getClientErrorMessage(payload, "暂时无法生成 BMI 预览。"));
    }

    return payload.data;
  }, []);

  const loadBmiPreview = useCallback(async (sessionId: string) => {
    const requestId = ++bmiPreviewRequestRef.current;
    setBmiPreviewError(null);
    try {
      const preview = await requestBmiPreview(sessionId);
      if (requestId !== bmiPreviewRequestRef.current) return;
      setBmiPreview(preview);
      setBmiPreviewError(null);
    } catch (caughtError) {
      if (requestId !== bmiPreviewRequestRef.current) return;
      setBmiPreview(null);
      setBmiPreviewError(
        caughtError instanceof Error && /[\u4e00-\u9fff]/.test(caughtError.message)
          ? caughtError.message
          : "暂时无法生成 BMI 预览，请稍后重试。",
      );
    }
  }, [requestBmiPreview]);

  const initializeSession = useCallback(async () => {
    try {
      const storedSessionId = readStoredSessionId(window.localStorage);
      if (storedSessionId !== null) {
        const restored = await requestProgress(storedSessionId);
        if (restored !== null) {
          setProgress(restored);
          if (hasBmiPreviewInputs(restored.answers)) {
            void loadBmiPreview(restored.sessionId);
          }
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
  }, [loadBmiPreview, requestProgress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initializeSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initializeSession]);

  const visibleQuestions = getVisibleQuestions(progress);
  const currentQuestion = visibleQuestions.find((question) => question.key === progress?.nextQuestionKey);
  const currentValue = currentQuestion === undefined ? undefined : progress?.answers[currentQuestion.key];
  const targetDateBounds = getTargetDateBounds(new Date());
  const visibleQuestionIndex = currentQuestion === undefined
    ? visibleQuestions.length - 1
    : visibleQuestions.findIndex((question) => question.key === currentQuestion.key);
  async function saveAnswer(value: string | number) {
    if (progress === null || currentQuestion === undefined) return;

    await saveQuestionAnswer(currentQuestion.key, value);
  }

  async function saveQuestionAnswer(questionKey: string, value: string | number) {
    if (progress === null) return;

    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/sessions/${progress.sessionId}/answers/${questionKey}`,
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

      const nextProgress = payload.data as Progress;
      setProgress(nextProgress);
      if (hasBmiPreviewInputs(nextProgress.answers)) {
        void loadBmiPreview(nextProgress.sessionId);
      }
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
    if (!window.confirm("重新开始后将创建一份新的测评记录，当前页面将不再显示原测评。确定继续吗？")) return;

    setError(null);
    setIsSaving(true);
    try {
      clearStoredSessionId(window.localStorage);
      setResult(null);
      setBmiPreview(null);
      setBmiPreviewError(null);
      bmiPreviewRequestRef.current += 1;
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
        <BmiGauge bmi={result.bmi} />
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
            <p><strong>系统预计日期</strong><span>{result.targetDate ? formatDisplayDate(result.targetDate) : "-"}</span></p>
            <p><strong>重要日期</strong><span>{result.requestedTargetDate ? formatDisplayDate(result.requestedTargetDate) : "未填写"}</span></p>
            <p><strong>预测日期来源</strong><span>{getTargetDateSourceLabel(result.targetDateSource)}</span></p>
            <p><strong>预测参考日期</strong><span>{result.forecastTargetDate ? formatDisplayDate(result.forecastTargetDate) : "-"}</span></p>
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

  const sourceOptions = currentQuestion.key === "targetDateSource"
    ? currentQuestion.options?.filter((option) =>
      option.value === "system" || progress.answers.bigDayType !== "none",
    )
    : currentQuestion.options;

  return (
    <main className="assessment-shell">
      <p className="eyebrow">个人健康测评</p>
      <div className="progress-track" aria-label="测评进度">
        <span style={{ width: `${((visibleQuestionIndex + 1) / visibleQuestions.length) * 100}%` }} />
      </div>
      <p className="step-label">第 {visibleQuestionIndex + 1} 步，共 {visibleQuestions.length} 步</p>
      <h1>{getQuestionTitle(currentQuestion, progress)}</h1>
      {currentQuestion.type === "notice" ? (
        <GoalResolutionNotice
          effectiveGoal={progress.answers.effectiveGoal}
          goalResolution={progress.answers.goalResolution}
          isSaving={isSaving}
          preview={bmiPreview}
          onChangeGoal={(goal) => void saveQuestionAnswer("goal", goal)}
          onContinue={() => void saveAnswer("confirmed")}
        />
      ) : null}
      {currentQuestion.key === "targetWeightKg" ? (
        <BmiPreviewPanel
          error={bmiPreviewError}
          goal={progress.answers.effectiveGoal ?? progress.answers.goal}
          preview={bmiPreview}
        />
      ) : null}
      {currentQuestion.type === "notice" ? null : currentQuestion.type === "select" ? (
        <div className="answer-list">
          {sourceOptions?.map((option) => (
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
          key={currentQuestion.key}
          className="number-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const rawValue = formData.get("value");
            if (currentQuestion.type === "date") {
              void saveAnswer(normalizeDateInput(formData, targetDateBounds));
            } else if (typeof rawValue === "string" && rawValue !== "") {
              void saveAnswer(Number(rawValue));
            }
          }}
        >
          <label>
            <span className="field-meta">
              <span>{currentQuestion.helperText}</span>
            </span>
            {currentQuestion.type === "date" ? (
              <ChineseDateInput
                defaultValue={typeof currentValue === "string" ? currentValue : undefined}
                maxDate={targetDateBounds.max}
                minDate={targetDateBounds.min}
              />
            ) : (
              <NumberAnswerInput
                autoFillValue={
                  currentQuestion.key === "targetWeightKg"
                    ? bmiPreview?.autoFillTargetWeightKg ?? null
                    : null
                }
                currentValue={typeof currentValue === "number" ? currentValue : undefined}
                question={currentQuestion}
              />
            )}
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

function NumberAnswerInput({
  autoFillValue,
  currentValue,
  question,
}: {
  autoFillValue: number | null;
  currentValue?: number;
  question: Question;
}) {
  const [value, setValue] = useState(
    currentValue !== undefined
      ? String(currentValue)
      : "",
  );
  const [hasEdited, setHasEdited] = useState(false);
  const displayedValue =
    !hasEdited && currentValue === undefined && value === "" && autoFillValue !== null
      ? String(autoFillValue)
      : value;

  return (
    <span className="input-shell">
      <input
        autoComplete="off"
        inputMode={question.key === "age" ? "numeric" : "decimal"}
        max={question.max}
        min={question.min}
        name="value"
        onChange={(event) => {
          setHasEdited(true);
          setValue(event.target.value);
        }}
        required
        step={question.key === "age" ? "1" : "0.1"}
        type="number"
        value={displayedValue}
      />
      {question.unit !== undefined ? <span className="input-unit">{question.unit}</span> : null}
    </span>
  );
}

function GoalResolutionNotice({
  effectiveGoal,
  goalResolution,
  isSaving,
  preview,
  onChangeGoal,
  onContinue,
}: {
  effectiveGoal: unknown;
  goalResolution: unknown;
  isSaving: boolean;
  preview: BmiPreview | null;
  onChangeGoal: (goal: "maintain_weight" | "gain_weight") => void;
  onContinue: () => void;
}) {
  const bmiText = preview === null ? "当前 BMI" : `当前 BMI：${preview.bmi}`;
  if (goalResolution === "BLOCKED_LOSS") {
    return (
      <section aria-label="目标调整提示" className="goal-resolution-notice">
        <strong>{bmiText}</strong>
        <p>当前 BMI 偏低，不建议继续减重。请选择增重或保持体重，再继续测评。</p>
        <div className="notice-actions">
          <button
            className="primary-button"
            disabled={isSaving}
            onClick={() => onChangeGoal("gain_weight")}
            type="button"
          >
            改为增重
          </button>
          <button
            className="secondary-button"
            disabled={isSaving}
            onClick={() => onChangeGoal("maintain_weight")}
            type="button"
          >
            改为保持体重
          </button>
        </div>
      </section>
    );
  }

  const isGain = goalResolution === "REDIRECT_TO_GAIN" || effectiveGoal === "gain_weight";
  return (
    <section aria-label="目标调整提示" className="goal-resolution-notice">
      <strong>{bmiText}</strong>
      <p>
        {isGain
          ? "当前 BMI 偏低，系统建议将目标调整为增重。点击继续后填写增重目标体重。"
          : "当前 BMI 偏高，系统建议将目标调整为减重。点击继续后填写减重目标体重。"}
      </p>
      <button className="primary-button" disabled={isSaving} onClick={onContinue} type="button">
        {isSaving ? "正在保存..." : "继续"}
      </button>
    </section>
  );
}

function getQuestionTitle(question: Question, progress: Progress) {
  if (question.key !== "targetWeightKg") return question.title;

  return progress.answers.effectiveGoal === "gain_weight"
    ? "您的增重目标体重是多少？"
    : progress.answers.effectiveGoal === "lose_weight"
      ? "您的减重目标体重是多少？"
      : question.title;
}

function getVisibleQuestions(progress: Progress | null) {
  const bigDayType = progress?.answers.bigDayType;
  const hasTargetWeight = progress?.answers.targetWeightKg !== undefined;
  return baseQuestions.filter((question) =>
    (question.key !== "bigDayDate" || (typeof bigDayType === "string" && bigDayType !== "none")) &&
    (question.key !== "targetWeightKg" || !hasTargetWeight),
  );
}

function hasBmiPreviewInputs(answers: Record<string, unknown>) {
  return (
    typeof answers.goal === "string" &&
    typeof answers.heightCm === "number" &&
    typeof answers.currentWeightKg === "number"
  );
}

function BmiPreviewPanel({
  error,
  goal,
  preview,
}: {
  error: string | null;
  goal: unknown;
  preview: BmiPreview | null;
}) {
  if (preview === null) {
    if (error !== null) {
      return <p className="error-message">{error}</p>;
    }

    return (
      <p className="preview-message">填写身高和当前体重后，这里会显示 BMI 和目标体重建议。</p>
    );
  }

  const range = preview.recommendedTargetWeightRange;
  return (
    <section aria-label="BMI 预览" className="bmi-preview">
      <div className="bmi-preview-heading">
        <strong>当前 BMI：{preview.bmi}</strong>
        <span>{getBmiCategoryLabel(preview.category)}</span>
      </div>
      {error !== null ? <p className="error-message">{error}</p> : null}
      {range !== null ? (
        <p>建议目标体重：{range.minKg} - {range.maxKg} 千克</p>
      ) : goal === "maintain_weight" ? (
        <p>保持体重目标将以当前体重为参考，请根据提示确认目标。</p>
      ) : goal === "gain_weight" ? (
        <p>当前目标以增重为主，请将目标体重设置得高于当前体重。</p>
      ) : preview.category === "LOW" ? (
        <p>当前 BMI 偏低，不建议继续降低目标体重，请改为增重或保持体重。</p>
      ) : (
        <p>当前体重已接近健康范围下沿，不建议继续降低目标体重。</p>
      )}
      {preview.autoFillTargetWeightKg !== null ? (
        <p className="preview-note">根据当前 BMI，目标体重已自动设置为当前体重，后续无需再次填写。</p>
      ) : null}
    </section>
  );
}

function ChineseDateInput({
  defaultValue,
  minDate,
  maxDate,
}: {
  defaultValue?: string;
  minDate: string;
  maxDate: string;
}) {
  const minParts = parseDateInput(minDate);
  const initialValue = defaultValue !== undefined && parseIsoDate(defaultValue) !== null
    ? defaultValue
    : minDate;
  const initialParts = normalizeDateParts(
    datePartsToStrings(parseDateInput(initialValue)),
    minDate,
    maxDate,
  );
  const [parts, setParts] = useState(initialParts);
  const inputBounds = getDateInputBounds(parts, minDate, maxDate);

  function updatePart(key: keyof DateParts, value: string) {
    setParts((current) => {
      const next = { ...current, [key]: value };
      if (key === "year" || key === "month") {
        const year = clampInteger(next.year, minParts.year, parseDateInput(maxDate).year, minParts.year);
        const month = clampInteger(next.month, 1, 12, minParts.month);
        const maximumDay = getDaysInMonth(year, month);
        const day = Number.parseInt(next.day, 10);
        if (Number.isFinite(day) && day > maximumDay) {
          next.day = String(maximumDay);
        }
      }
      return next;
    });
  }

  function normalizeParts() {
    setParts((current) => normalizeDateParts(current, minDate, maxDate));
  }

  return (
    <div className="date-input-group">
      <div className="date-part">
        <input
          aria-label="年份"
          inputMode="numeric"
          max={parseDateInput(maxDate).year}
          min={minParts.year}
          name="year"
          onBlur={normalizeParts}
          onChange={(event) => updatePart("year", event.target.value)}
          type="number"
          value={parts.year}
        />
        <span>年</span>
      </div>
      <div className="date-part date-part-short">
        <input
          aria-label="月份"
          inputMode="numeric"
          max={inputBounds.monthMax}
          min={inputBounds.monthMin}
          name="month"
          onBlur={normalizeParts}
          onChange={(event) => updatePart("month", event.target.value)}
          type="number"
          value={parts.month}
        />
        <span>月</span>
      </div>
      <div className="date-part date-part-short">
        <input
          aria-label="日期"
          inputMode="numeric"
          max={inputBounds.dayMax}
          min={inputBounds.dayMin}
          name="day"
          onBlur={normalizeParts}
          onChange={(event) => updatePart("day", event.target.value)}
          type="number"
          value={parts.day}
        />
        <span>日</span>
      </div>
    </div>
  );
}

type DateParts = { year: string; month: string; day: string };

function normalizeDateInput(formData: FormData, bounds: { min: string; max: string }) {
  const parts = normalizeDateParts(
    {
      year: String(formData.get("year") ?? ""),
      month: String(formData.get("month") ?? ""),
      day: String(formData.get("day") ?? ""),
    },
    bounds.min,
    bounds.max,
  );
  return formatIsoDate(new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  )));
}

function normalizeDateParts(
  parts: DateParts,
  minDateInput: string,
  maxDateInput: string,
): DateParts {
  const minDate = parseDateInput(minDateInput);
  const maxDate = parseDateInput(maxDateInput);
  const year = clampInteger(parts.year, minDate.year, maxDate.year, minDate.year);
  const month = clampInteger(parts.month, 1, 12, minDate.month);
  const day = clampInteger(parts.day, 1, getDaysInMonth(year, month), minDate.day);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const minimum = new Date(Date.UTC(minDate.year, minDate.month - 1, minDate.day));
  const maximum = new Date(Date.UTC(maxDate.year, maxDate.month - 1, maxDate.day));

  if (candidate < minimum) return datePartsToStrings(minDate);
  if (candidate > maximum) return datePartsToStrings(maxDate);
  return { year: String(year), month: String(month), day: String(day) };
}

function clampInteger(value: string, minimum: number, maximum: number, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseDateInput(value: string) {
  const parsed = parseIsoDate(value);
  if (parsed === null) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return parsed;
}

function datePartsToStrings(parts: { year: number; month: number; day: number }): DateParts {
  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getDateInputBounds(parts: DateParts, minDateInput: string, maxDateInput: string) {
  const minDate = parseDateInput(minDateInput);
  const maxDate = parseDateInput(maxDateInput);
  const year = clampInteger(parts.year, minDate.year, maxDate.year, minDate.year);
  const month = clampInteger(parts.month, 1, 12, minDate.month);
  const calendarMaximumDay = getDaysInMonth(year, month);

  return {
    monthMin: year === minDate.year ? minDate.month : 1,
    monthMax: year === maxDate.year ? maxDate.month : 12,
    dayMin: year === minDate.year && month === minDate.month ? minDate.day : 1,
    dayMax: Math.min(
      calendarMaximumDay,
      year === maxDate.year && month === maxDate.month ? maxDate.day : calendarMaximumDay,
    ),
  };
}

function BmiGauge({ bmi }: { bmi: number }) {
  const markerPosition = getBmiMarkerPosition(bmi);

  return (
    <section aria-label="BMI 区间" className="bmi-gauge">
      <div className="bmi-gauge-heading">
        <strong>BMI 区间参考</strong>
        <span>{getBmiCategoryLabelFromValue(bmi)}</span>
      </div>
      <div className="bmi-scale">
        <span className="bmi-segment bmi-low" />
        <span className="bmi-segment bmi-normal" />
        <span className="bmi-segment bmi-high" />
        <span className="bmi-segment bmi-very-high" />
        <span className="bmi-marker" style={{ left: `${markerPosition}%` }} />
      </div>
      <div className="bmi-scale-labels" aria-hidden="true">
        <span>偏低</span>
        <span>正常</span>
        <span>偏高</span>
        <span>较高</span>
      </div>
      <p className="bmi-note">BMI 是成人常用筛查指标，不等同于医疗诊断。</p>
    </section>
  );
}

const bmiVisualSegments = [
  { min: 14, max: 18.5, startPercent: 0, widthPercent: 25 },
  { min: 18.5, max: 24, startPercent: 25, widthPercent: 25 },
  { min: 24, max: 28, startPercent: 50, widthPercent: 25 },
  { min: 28, max: 40, startPercent: 75, widthPercent: 25 },
] as const;

function getBmiMarkerPosition(bmi: number) {
  const clampedBmi = Math.min(Math.max(bmi, 14), 40);
  const segment =
    bmiVisualSegments.find((candidate) => clampedBmi <= candidate.max) ??
    bmiVisualSegments[bmiVisualSegments.length - 1];
  const segmentProgress = (clampedBmi - segment.min) / (segment.max - segment.min);

  return segment.startPercent + segmentProgress * segment.widthPercent;
}

function getBmiCategoryLabel(category: BmiPreview["category"]) {
  if (category === "LOW") return "偏低";
  if (category === "NORMAL") return "正常";
  if (category === "HIGH") return "偏高";
  return "较高";
}

function getBmiCategoryLabelFromValue(bmi: number) {
  if (bmi < 18.5) return "偏低";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "偏高";
  return "较高";
}

function getTargetDateSourceLabel(source?: VisibleResult["targetDateSource"]) {
  return source === "IMPORTANT_DATE" ? "重要日期" : "系统预计日期";
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
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
  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = padding + ((maximumWeight - point.projectedWeightKg) / range) * (height - padding * 2);
    return { x, y };
  });
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <section aria-label="体重预测趋势" className="forecast-chart">
      <div className="forecast-heading">
        <strong>体重预测趋势</strong>
        <span>每周预计变化 {Math.abs(forecast.expectedWeeklyChangeKg)} 千克</span>
      </div>
      <svg aria-hidden="true" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <polyline points={polyline} />
        {points.map((point, index) => (
          <circle cx={coordinates[index]!.x} cy={coordinates[index]!.y} key={point.week} r="3" />
        ))}
      </svg>
      <div className="forecast-labels">
        <span>第 {points[0]!.week} 周 · {points[0]!.projectedWeightKg} 千克</span>
        <span>第 {points.at(-1)!.week} 周 · {points.at(-1)!.projectedWeightKg} 千克</span>
      </div>
    </section>
  );
}
