import { expect, type Page } from "@playwright/test";

export type AdminRole = "owner" | "operator";

const adminAccounts: Record<AdminRole, { email: string; password: string; displayName: string }> = {
  owner: {
    email: "owner@example.com",
    password: "owner123456",
    displayName: "系统所有者"
  },
  operator: {
    email: "operator@example.com",
    password: "operator123456",
    displayName: "运营人员"
  }
};

export async function loginAsAdmin(page: Page, role: AdminRole = "owner") {
  const account = adminAccounts[role];

  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard|\/admin$/);
  await expect(page.getByText(account.displayName, { exact: true }).first()).toBeVisible();

  return account;
}
