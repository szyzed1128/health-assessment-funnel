import { expect, test } from "@playwright/test";

test("persists an assessment, restores it, and unlocks the member result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "女性" }).click();
  await page.getByRole("button", { name: "减重" }).click();

  const numberSteps = [
    { heading: "您的年龄是多少？", helper: "可输入 18-100", value: "32" },
    { heading: "您的身高是多少？", helper: "可输入 100-250", value: "168" },
    { heading: "您目前的体重是多少？", helper: "可输入 30-350", value: "75" },
  ];

  for (const step of numberSteps) {
    await expect(page.getByRole("heading", { name: step.heading })).toBeVisible();
    await expect(page.getByText(step.helper)).toBeVisible();
    await page.getByRole("spinbutton").fill(step.value);
    await page.getByRole("button", { name: "继续" }).click();
  }

  await expect(page.getByRole("heading", { name: "您的减重目标体重是多少？" })).toBeVisible();
  await expect(page.getByRole("region", { name: "BMI 预览" })).toBeVisible();
  await expect(page.getByText("建议目标体重：52.2 - 67.6 千克")).toBeVisible();
  await page.getByRole("spinbutton").fill("65");
  await page.getByRole("button", { name: "继续" }).click();

  await page.getByRole("button", { name: "婚礼" }).click();
  await expect(page.getByRole("heading", { name: "重要日期是哪一天？" })).toBeVisible();

  const importantDate = futureDateInput(140);
  const [year, month, day] = importantDate.split("-");
  await page.getByLabel("年份").fill(year!);
  await page.getByLabel("月份").fill(String(Number(month)));
  await page.getByLabel("日期").fill(String(Number(day)));
  await page.getByRole("button", { name: "继续" }).click();

  await page.getByRole("button", { name: "使用我的重要日期" }).click();
  await page.getByRole("button", { name: "每周 1-2 次" }).click();
  await expect(page.getByRole("button", { name: "查看我的结果" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "查看我的结果" })).toBeVisible();
  await page.getByRole("button", { name: "查看我的结果" }).click();
  await expect(page.getByText("您的免费结果")).toBeVisible();
  await expect(page.getByText("解锁完整个性化健康报告，查看详细建议与预测数据。")).toBeVisible();

  await page.getByRole("button", { name: "解锁完整报告" }).click();
  await expect(page.getByText("您的完整报告")).toBeVisible();
  await expect(page.getByText("每日建议摄入")).toBeVisible();
  await expect(page.getByText("预测日期来源")).toBeVisible();
  await expect(page.locator(".result-details strong").filter({ hasText: "重要日期" })).toBeVisible();
  await expect(page.getByRole("region", { name: "体重预测趋势" })).toBeVisible();

  await page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重新开始测评" }).click();
  await expect(page.getByText("请选择您的性别")).toBeVisible();
});

test("skips the important date and uses the system forecast date", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "女性" }).click();
  await page.getByRole("button", { name: "减重" }).click();

  const numberSteps = [
    { heading: "您的年龄是多少？", value: "32" },
    { heading: "您的身高是多少？", value: "168" },
    { heading: "您目前的体重是多少？", value: "75" },
    { heading: "您的减重目标体重是多少？", value: "65" },
  ];

  for (const step of numberSteps) {
    await expect(page.getByRole("heading", { name: step.heading })).toBeVisible();
    await page.getByRole("spinbutton").fill(step.value);
    await page.getByRole("button", { name: "继续" }).click();
  }

  await page.getByRole("button", { name: "没有重要日期" }).click();
  await expect(page.getByRole("heading", { name: "你希望按哪一天作为目标参考？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "使用我的重要日期" })).toHaveCount(0);
  await page.getByRole("button", { name: "使用系统预计日期" }).click();
  await page.getByRole("button", { name: "每周 1-2 次" }).click();
  await page.getByRole("button", { name: "查看我的结果" }).click();

  await expect(page.getByText("您的免费结果")).toBeVisible();
  await page.getByRole("button", { name: "解锁完整报告" }).click();
  await expect(page.getByText("重要日期")).toBeVisible();
  await expect(page.getByText("未填写")).toBeVisible();
  await expect(page.getByText("系统预计日期", { exact: true }).last()).toBeVisible();
});

test("auto-fills and skips the maintenance target weight when BMI is eligible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "女性" }).click();
  await page.getByRole("button", { name: "保持体重" }).click();

  const numberSteps = [
    { heading: "您的年龄是多少？", value: "32" },
    { heading: "您的身高是多少？", value: "168" },
    { heading: "您目前的体重是多少？", value: "65" },
  ];

  for (const step of numberSteps) {
    await expect(page.getByRole("heading", { name: step.heading })).toBeVisible();
    await page.getByRole("spinbutton").fill(step.value);
    await page.getByRole("button", { name: "继续" }).click();
  }

  await expect(page.getByRole("heading", { name: "最近是否有重要日期？" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "您的目标体重是多少？" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "您的减重目标体重是多少？" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "您的增重目标体重是多少？" })).toHaveCount(0);
});

test("starts important dates at the live minimum and clamps impossible calendar days", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "女性" }).click();
  await page.getByRole("button", { name: "减重" }).click();

  const numberSteps = [
    { heading: "您的年龄是多少？", value: "32" },
    { heading: "您的身高是多少？", value: "168" },
    { heading: "您目前的体重是多少？", value: "75" },
    { heading: "您的减重目标体重是多少？", value: "65" },
  ];
  for (const step of numberSteps) {
    await expect(page.getByRole("heading", { name: step.heading })).toBeVisible();
    await page.getByRole("spinbutton").fill(step.value);
    await page.getByRole("button", { name: "继续" }).click();
  }
  await page.getByRole("button", { name: "婚礼" }).click();

  const minimum = new Date();
  minimum.setUTCDate(minimum.getUTCDate() + 14);
  await expect(page.getByLabel("年份")).toHaveValue(String(minimum.getUTCFullYear()));
  await expect(page.getByLabel("月份")).toHaveValue(String(minimum.getUTCMonth() + 1));
  await expect(page.getByLabel("日期")).toHaveValue(String(minimum.getUTCDate()));

  const futureYear = minimum.getUTCFullYear() + 1;
  await page.getByLabel("年份").fill(String(futureYear));
  await page.getByLabel("月份").fill("2");
  await page.getByLabel("日期").fill("31");
  await page.getByLabel("日期").press("Tab");
  await expect(page.getByLabel("日期")).toHaveValue("28");
});

function futureDateInput(daysFromNow: number) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
  return date.toISOString().slice(0, 10);
}
