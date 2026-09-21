"use client";

export type VisibleResult = {
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
    expectedWeeklyChangeKg?: number;
    points: Array<{ week: number; projectedWeightKg: number }>;
  };
  actionPlan?: unknown;
};

export function ResultReport({
  isBusy = false,
  onRestart,
  onUnlock,
  result,
  sessionId,
}: {
  isBusy?: boolean;
  onRestart?: () => void;
  onUnlock?: () => void;
  result: VisibleResult;
  sessionId: string;
}) {
  return (
    <main className="assessment-shell">
      <p className="eyebrow">您的健康测评</p>
      <h1>{result.access === "MEMBER" ? "您的完整报告" : "您的免费结果"}</h1>
      <p className="session-meta">当前 Session ID：<code>{sessionId}</code></p>
      <div className="result-summary">
        <p><strong>BMI 指数</strong><span>{result.bmi}</span></p>
        <p><strong>结果摘要</strong><span>{result.summary}</span></p>
        <p><strong>目标体重差</strong><span>{result.targetWeightDifferenceKg} 千克</span></p>
      </div>
      <BmiGauge bmi={result.bmi} />
      {result.access === "FREE" ? (
        <>
          <p className="muted">{result.upgradePrompt}</p>
          <button className="primary-button" disabled={isBusy} onClick={onUnlock} type="button">
            前往模拟支付
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
      {onRestart !== undefined ? (
        <button className="secondary-button" disabled={isBusy} onClick={onRestart} type="button">
          重新开始测评
        </button>
      ) : null}
    </main>
  );
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
        <span>每周预计变化 {Math.abs(forecast.expectedWeeklyChangeKg ?? 0)} 千克</span>
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
