import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";

test("admin pages require a staff session and logout invalidates access", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fdashboard/);

  await loginAsAdmin(page, "owner");
  await expect(page.getByText("STAFF_OWNER / 所有者", { exact: true })).toBeVisible();
  await expect(page.getByTestId("admin-member-verification-metrics")).toBeVisible();
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
});
