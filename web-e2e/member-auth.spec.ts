import { expect, test } from "@playwright/test";
import { isolateMemberAuthTestClient } from "./helpers/member-auth";

const API_BASE = "http://localhost:3000/api";

test("member logout revokes the server session and clears the browser session", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const phone = `139${runId}`;

  await isolateMemberAuthTestClient(page, phone);
  await page.goto("/member");
  await expect(
    page.getByRole("button", { name: "按手机号查询" })
  ).toHaveCount(0);
  await page.getByLabel("会员昵称").fill(`会话会员${runId}`);
  await page.getByLabel("会员手机号").fill(phone);
  await page.getByTestId("member-request-code").click();
  await expect(page.getByTestId("member-login-code")).toHaveValue(/^\d{6}$/);
  await page.getByTestId("member-login-submit").click();

  await expect(page.getByTestId("member-session-status")).toContainText(
    "当前已登录"
  );
  await expect(page.getByTestId("member-session-status")).toContainText(
    runId.slice(-4)
  );
  const sessionToken = await page.evaluate(() =>
    localStorage.getItem("kzt_member_session")
  );
  expect(sessionToken).toMatch(/^member_/);

  await page.getByTestId("member-logout").click();

  await expect(page.getByTestId("member-session-status")).toHaveCount(0);
  await expect(page.getByText("已安全退出会员中心。")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("kzt_member_session"))
    )
    .toBeNull();

  const profile = await request.get(`${API_BASE}/members/me`, {
    headers: { "X-Member-Token": sessionToken! }
  });
  expect(profile.status()).toBe(401);

  await page.reload();
  await expect(page.getByTestId("member-session-status")).toHaveCount(0);
});
