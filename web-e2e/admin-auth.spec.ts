import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";

test("admin pages require a staff session and logout invalidates access", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fdashboard/);

  await loginAsAdmin(page, "owner");
  await expect(page.getByText("STAFF_OWNER / 所有者", { exact: true })).toBeVisible();
  await expect(page.getByTestId("admin-member-verification-metrics")).toBeVisible();
  const launchReadinessCard = page.getByTestId("admin-cloud-pet-launch-readiness");
  await expect(launchReadinessCard).toBeVisible();
  await expect(
    launchReadinessCard.getByTestId("admin-cloud-pet-launch-readiness-status")
  ).toContainText("需要处理");
  const deploymentCard = page.getByTestId("admin-deployment-readiness");
    await expect(deploymentCard).toContainText("当前发布");
    await expect(deploymentCard).toContainText("未标识");
    await expect(deploymentCard).toContainText("Web 发布");
    await expect(deploymentCard).toContainText("Web 与 API 发布");
    await expect(deploymentCard).toContainText("数据库迁移");
  await expect(
    launchReadinessCard.getByTestId(
      "admin-cloud-pet-launch-readiness-link-API_NOT_READY"
    )
  ).toHaveAttribute("href", "#admin-deployment-readiness");
  await expect(
    launchReadinessCard.getByTestId(
      "admin-cloud-pet-launch-readiness-link-RECOVERY_NOT_VERIFIED"
    )
  ).toHaveAttribute("href", "#admin-data-protection");
  await launchReadinessCard
    .getByTestId("admin-cloud-pet-launch-readiness-link-API_NOT_READY")
    .click();
  await expect(page).toHaveURL(/#admin-deployment-readiness$/);
  await expect(page.locator("#admin-deployment-readiness")).toBeVisible();
  await launchReadinessCard
    .getByTestId("admin-cloud-pet-launch-readiness-link-RECOVERY_NOT_VERIFIED")
    .click();
  await expect(page).toHaveURL(/#admin-data-protection$/);
  await expect(page.locator("#admin-data-protection")).toBeVisible();
  await launchReadinessCard
    .getByTestId("admin-cloud-pet-launch-readiness-refresh")
    .click();
  await expect(deploymentCard).toBeVisible();
  await expect(
    deploymentCard.getByTestId("admin-deployment-readiness-status")
  ).toContainText("需要关注");
  await deploymentCard
    .getByTestId("admin-deployment-readiness-refresh")
    .click();
  const healthCard = page.getByTestId("admin-cloud-pet-ops-health");
  await expect(healthCard).toBeVisible();
  await expect(
    healthCard.getByTestId("admin-cloud-pet-ops-health-status")
  ).toContainText("系统运行正常");
  await healthCard
    .getByTestId("admin-cloud-pet-ops-health-refresh")
    .click();
  await expect(
    healthCard.getByTestId("admin-cloud-pet-ops-health-updated-at")
  ).toBeVisible();
  const recoveryCard = page.getByTestId("admin-sqlite-recovery-status");
  await expect(recoveryCard).toBeVisible();
  await expect(
    recoveryCard.getByTestId("admin-sqlite-recovery-status-value")
  ).toContainText("未配置恢复状态目录");
  await expect(
    recoveryCard.getByTestId("admin-sqlite-recovery-freshness")
  ).toContainText("备份新鲜度：未知");
  await expect(
    recoveryCard.getByTestId("admin-sqlite-recovery-auto-refresh")
  ).toContainText("自动数据保护：未启用");
  await expect(
    recoveryCard.getByTestId("admin-sqlite-recovery-auto-refresh-runtime")
  ).toHaveCount(0);
  await expect(
    recoveryCard.getByTestId("admin-sqlite-recovery-run")
  ).toBeVisible();
  await recoveryCard
    .getByTestId("admin-sqlite-recovery-status-refresh")
    .click();
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/pets/daily-diary-coverage");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpets%2Fdaily-diary-coverage/);
});

test("operator sees cloud pet operations but cannot edit owner-only rules", async ({
  page
}) => {
  await loginAsAdmin(page, "operator");

  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  const growthTaskForms = cloudPetSection.getByTestId(
    "admin-cloud-pet-growth-task-form"
  );
  await expect(growthTaskForms.first()).toBeVisible();
  const growthTaskSaveButtons = growthTaskForms.getByRole("button", {
    name: "保存配置"
  });
  const growthTaskCount = await growthTaskSaveButtons.count();
  expect(growthTaskCount).toBeGreaterThan(0);

  for (let index = 0; index < growthTaskCount; index += 1) {
    await expect(growthTaskSaveButtons.nth(index)).toBeDisabled();
  }

  const careRules = cloudPetSection.getByTestId(
    "admin-cloud-pet-care-score-rules-form"
  );
  await expect(
    careRules.getByRole("button", { name: "保存照护分规则" })
  ).toBeDisabled();
  await expect(careRules).toContainText("缺少 cloud_pets:write 权限");
  await expect(page.getByTestId("admin-cloud-pet-ops-health")).toHaveCount(0);
  await expect(page.getByTestId("admin-cloud-pet-launch-readiness")).toHaveCount(0);
  await expect(page.getByTestId("admin-deployment-readiness")).toHaveCount(0);
  await expect(page.getByTestId("admin-sqlite-recovery-status")).toHaveCount(0);
});
