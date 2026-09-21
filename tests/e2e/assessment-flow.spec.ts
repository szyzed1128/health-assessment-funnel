import { expect, test } from "@playwright/test";

test("persists an assessment, restores it, and unlocks the member result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "女性" }).click();
  await page.getByRole("button", { name: "减重" }).click();

  for (const value of ["32", "168", "75", "65"]) {
    await page.getByRole("spinbutton").fill(value);
    await page.getByRole("button", { name: "继续" }).click();
  }
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
  await expect(page.getByRole("region", { name: "体重预测趋势" })).toBeVisible();

  await page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "重新开始测评" }).click();
  await expect(page.getByText("请选择您的性别")).toBeVisible();
});
