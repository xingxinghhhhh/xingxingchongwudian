import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loginAsAdmin } from "./helpers/admin";
import { loginAsVerifiedMember } from "./helpers/member-auth";

const API_BASE = "http://localhost:3000/api";

type SeededReport = {
  memberPhone: string;
  petNo: string;
  postBody: string;
  postNo: string;
  reportNo: string;
};

async function seedCommunityReport(
  request: APIRequestContext,
  input: { ownerName: string; phone: string; petName: string; reason: string }
): Promise<SeededReport> {
  const login = await loginAsVerifiedMember(request, {
    name: input.ownerName,
    phone: input.phone
  });
  const sessionToken = login.sessionToken;

  const pet = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName: input.ownerName,
      ownerPhone: input.phone,
      name: input.petName,
      species: "cat",
      personality: "Admin moderation filter smoke path."
    },
    headers: { "X-Member-Token": sessionToken }
  });
  expect(pet.ok()).toBeTruthy();
  const petBody = await pet.json();
  const petNo = petBody.petNo as string;
  const postBody = `Moderation report seed for ${input.petName}`;

  const post = await request.post(`${API_BASE}/community/posts`, {
    data: {
      petNo,
      body: postBody
    },
    headers: { "X-Member-Token": sessionToken }
  });
  expect(post.ok()).toBeTruthy();
  const postPayload = await post.json();
  const postNo = postPayload.postNo as string;

  const report = await request.post(`${API_BASE}/community/posts/${postNo}/reports`, {
    data: { reason: input.reason },
    headers: { "X-Member-Token": sessionToken }
  });
  expect(report.ok()).toBeTruthy();
  const reportBody = await report.json();

  return {
    memberPhone: input.phone,
    petNo,
    postBody,
    postNo,
    reportNo: reportBody.reportNo as string
  };
}

test("admin report queue filters community reports by status, post, and member", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const target = await seedCommunityReport(request, {
    ownerName: `Admin Filter Owner ${runId}`,
    phone: `136${runId}`,
    petName: `Filter Pet ${runId}`,
    reason: `Target report ${runId}`
  });
  const other = await seedCommunityReport(request, {
    ownerName: `Admin Other Owner ${runId}`,
    phone: `137${runId}`,
    petName: `Other Pet ${runId}`,
    reason: `Other report ${runId}`
  });

  await loginAsAdmin(page, "owner");
  const healthCard = page.getByTestId("admin-cloud-pet-ops-health");
  const pendingReportsLink = healthCard.getByTestId(
    "admin-health-pending-reports-link"
  );
  await expect(pendingReportsLink).toBeVisible();
  await pendingReportsLink.click();
  await expect(page).toHaveURL(
    /\/admin\?reportStatus=pending_review#admin-community-reports/
  );

  const reportSection = page.locator("#admin-community-reports");
  await expect(
    reportSection.getByTestId("admin-community-report-filter-status")
  ).toHaveValue("pending_review");
  await expect(reportSection.getByText(target.reportNo)).toBeVisible();
  await expect(reportSection.getByText(other.reportNo)).toBeVisible();

  await reportSection.getByTestId("admin-community-report-filter-status").selectOption("pending_review");
  await reportSection.getByTestId("admin-community-report-filter-post").fill(target.postNo);
  await reportSection.getByTestId("admin-community-report-filter-member").fill(target.memberPhone);

  const filteredResponse = page.waitForResponse((response) => {
    const url = response.url();
    return (
      url.includes("/api/admin/community/reports") &&
      url.includes("status=pending_review") &&
      url.includes(`postNo=${target.postNo}`) &&
      url.includes(`memberPhone=${target.memberPhone}`)
    );
  });
  await reportSection.getByTestId("admin-community-report-filter-form").getByRole("button", {
    name: "应用筛选"
  }).click();
  expect((await filteredResponse).ok()).toBeTruthy();

  await expect(reportSection.getByText(target.reportNo)).toBeVisible();
  await expect(reportSection.getByText(other.reportNo)).toHaveCount(0);
  await expect(page.getByText("社区举报筛选已应用，共 1 条结果。"))
    .toBeVisible();
});

test("owner can backfill a selected daily diary gap from the admin page", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Diary Gap Owner ${runId}`;
  const phone = `133${runId}`;
  const petName = `Diary Gap Pet ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "dog",
      personality: "Needs an operator-created presence diary."
    },
    headers: { "X-Member-Token": member.sessionToken }
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  await loginAsAdmin(page, "owner");
  const healthCard = page.getByTestId("admin-cloud-pet-ops-health");
  const diaryGapLink = healthCard.getByTestId("admin-health-diary-gap-link");
  await expect(diaryGapLink).toBeVisible();
  await expect(diaryGapLink).toHaveAttribute(
    "href",
    /\/admin\/pets\/daily-diary-coverage\?date=\d{4}-\d{2}-\d{2}/
  );
  await diaryGapLink.click();
  await expect(page).toHaveURL(
    /\/admin\/pets\/daily-diary-coverage\?date=\d{4}-\d{2}-\d{2}/
  );
  await page.goto("/admin/pets/daily-diary-coverage");
  await expect(page).toHaveURL(/\/admin\/pets\/daily-diary-coverage/);

  const missingPet = page.locator(
    `[data-testid="admin-diary-missing-pet"][data-pet-no="${petNo}"]`
  );
  await expect(missingPet).toBeVisible();
  await expect(missingPet).toContainText("今日未完成成长任务");
  await missingPet.getByRole("checkbox", { name: `选择 ${petName}` }).check();
  await expect(page.getByTestId("admin-diary-selected-count")).toHaveText(
    "已选 1 只"
  );

  const backfillResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(
        "/api/admin/pets/daily-diary-coverage/backfill"
      ) && response.request().method() === "POST"
  );
  await page.getByTestId("admin-diary-backfill-selected").click();
  expect((await backfillResponse).status()).toBe(201);

  await expect(page.getByTestId("admin-diary-backfill-result")).toContainText(
    petName
  );
  await expect(page.getByTestId("admin-diary-backfill-result")).toContainText(
    "已补救"
  );
  await expect(missingPet).toHaveCount(0);
});

test("admin cloud pet diary gap signal opens the existing coverage workflow", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Diary Signal Owner ${runId}`;
  const phone = `134${runId}`;
  const petName = `Gap Signal ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "cat",
      personality: "Keeps the detail diary gap action connected to coverage."
    },
    headers: { "X-Member-Token": member.sessionToken }
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(petNo);
  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${petNo}`)
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
  );
  await expect(listItem).toBeVisible();
  await listItem.getByTestId("admin-cloud-pet-detail-open").click();

  const riskSignals = cloudPetSection.getByTestId("admin-cloud-pet-risk-signals");
  await expect(riskSignals).toContainText("今日日记缺失");
  const diaryGapAction = riskSignals.getByRole("link", { name: "查看日记缺口" });
  await expect(diaryGapAction).toHaveAttribute(
    "href",
    `/admin/pets/daily-diary-coverage?petNo=${petNo}`
  );
  await diaryGapAction.click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/pets/daily-diary-coverage\\?petNo=${petNo}`)
  );
  await expect(
    page.getByTestId("admin-diary-coverage-pet-filter")
  ).toHaveText(petNo);
  await expect(
    page.locator(
      `[data-testid="admin-diary-missing-pet"][data-pet-no="${petNo}"]`
    )
  ).toHaveCount(1);
});

test("admin cloud pet pending report signal opens its scoped report queue", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const target = await seedCommunityReport(request, {
    ownerName: `Scoped Report Owner ${runId}`,
    phone: `139${runId}`,
    petName: `Report ${runId}`,
    reason: `Scoped report ${runId}`
  });

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(target.petNo);
  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${target.petNo}`)
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${target.petNo}"]`
  );
  await expect(listItem).toBeVisible();
  await listItem.getByTestId("admin-cloud-pet-detail-open").click();

  const riskSignals = cloudPetSection.getByTestId("admin-cloud-pet-risk-signals");
  await expect(riskSignals).toContainText("社区举报待处理");
  const reportAction = riskSignals.getByRole("link", { name: "处理举报" });
  await expect(reportAction).toHaveAttribute(
    "href",
    `/admin?reportStatus=pending_review&reportPostNo=${target.postNo}#admin-community-reports`
  );

  const reportsResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/community/reports?") &&
      response.url().includes(`postNo=${target.postNo}`)
  );
  await reportAction.click();
  expect((await reportsResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(
    new RegExp(`/admin\\?reportStatus=pending_review&reportPostNo=${target.postNo}#admin-community-reports`)
  );

  const reportSection = page.locator("#admin-community-reports");
  await expect(
    reportSection.getByTestId("admin-community-report-filter-status")
  ).toHaveValue("pending_review");
  await expect(
    reportSection.getByTestId("admin-community-report-filter-post")
  ).toHaveValue(target.postNo);
  await expect(
    reportSection.locator(
      `[data-testid="admin-community-report-item"][data-report-no="${target.reportNo}"]`
    )
  ).toBeVisible();
});

test("owner can resolve a report and hide its public post", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const target = await seedCommunityReport(request, {
    ownerName: `Resolve Report Owner ${runId}`,
    phone: `131${runId}`,
    petName: `Resolve Pet ${runId}`,
    reason: `Hide reported post ${runId}`
  });

  await loginAsAdmin(page, "owner");
  const reportSection = page.locator("#admin-community-reports");
  const reportItem = reportSection.locator(
    `[data-testid="admin-community-report-item"][data-report-no="${target.reportNo}"]`
  );
  await expect(reportItem).toBeVisible();
  await expect(reportItem.getByTestId("admin-community-report-status"))
    .toContainText("待审核");

  const postUpdate = page.waitForResponse(
    (response) =>
      response.url().endsWith(
        `/api/admin/community/posts/${target.postNo}/status`
      ) && response.request().method() === "PATCH"
  );
  const reportUpdate = page.waitForResponse(
    (response) =>
      response.url().endsWith(
        `/api/admin/community/reports/${target.reportNo}/status`
      ) && response.request().method() === "PATCH"
  );
  await reportItem.getByTestId("admin-community-report-resolve-hide").click();
  expect((await postUpdate).ok()).toBeTruthy();
  expect((await reportUpdate).ok()).toBeTruthy();

  await expect(reportItem.getByTestId("admin-community-report-status"))
    .toContainText("已处理");
  await expect(reportItem).toContainText("商家后台已处理并隐藏关联帖子");
  await expect(
    reportItem.getByTestId("admin-community-report-resolve-hide")
  ).toHaveCount(0);

  const postSection = page.locator("#admin-community-posts");
  const moderatedPost = postSection.locator(".admin-post", {
    hasText: target.postNo
  });
  await expect(moderatedPost).toContainText("hidden");

  await page.goto(`/cloud-pets/${target.petNo}`);
  await expect(page.getByTestId("pet-public-community-posts")).not.toContainText(
    target.postBody
  );
});

test("owner can filter a cloud pet and inspect its operational detail", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Ops Detail Owner ${runId}`;
  const phone = `132${runId}`;
  const petName = `Ops Detail Pet ${runId}`;
  const diaryTitle = `Ops diary ${runId}`;
  const postBody = `Ops community signal ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const headers = { "X-Member-Token": member.sessionToken };
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "dog",
      personality: "Provides a complete admin operational detail sample."
    },
    headers
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  const careResponse = await request.post(
    `${API_BASE}/cloud-pets/${petNo}/growth-tasks/daily-care/complete`,
    { headers }
  );
  expect(careResponse.ok()).toBeTruthy();
  const diaryResponse = await request.post(
    `${API_BASE}/cloud-pets/${petNo}/diary-notes`,
    {
      data: {
        title: diaryTitle,
        body: `Operational diary detail for ${petName}.`
      },
      headers
    }
  );
  expect(diaryResponse.ok()).toBeTruthy();
  const postResponse = await request.post(`${API_BASE}/community/posts`, {
    data: { petNo, body: postBody },
    headers
  });
  expect(postResponse.ok()).toBeTruthy();
  const visitResponse = await request.post(
    `${API_BASE}/cloud-pets/${petNo}/homepage/visits`,
    {
      data: {
        source: "admin_ops_test",
        visitorId: `ops_visitor_${runId}`
      }
    }
  );
  expect(visitResponse.ok()).toBeTruthy();

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(petNo);
  await cloudPetSection
    .getByTestId("admin-cloud-pet-filter-species")
    .selectOption("dog");

  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${petNo}`) &&
      response.url().includes("species=dog")
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
  );
  await expect(listItem).toBeVisible();
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-list-item")
  ).toHaveCount(1);

  const exportButton = cloudPetSection.getByTestId("admin-cloud-pet-export");
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cloud-pets-\d{4}-\d{2}-\d{2}\.csv$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await readFile(downloadPath!, "utf8");
  expect(csv).toContain("宠物编号");
  expect(csv).toContain(petNo);
  expect(csv).not.toContain(phone);
  expect(csv).not.toContain(ownerName);
  expect(csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n")).toHaveLength(2);

  await listItem.getByTestId("admin-cloud-pet-detail-open").click();

  const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
  await expect(detail).toContainText(petName);
  await expect(detail).toContainText(phone);
  await expect(detail.getByTestId("admin-cloud-pet-recent-diaries")).toContainText(
    diaryTitle
  );
  await expect(
    detail.getByTestId("admin-cloud-pet-recent-community-posts")
  ).toContainText(postBody);
  await expect(detail).toContainText("主页访问：1");
  await expect(detail.getByTestId("admin-cloud-pet-risk-signals")).toBeVisible();

  const publicHomepageLink = detail.getByTestId("admin-cloud-pet-public-homepage");
  await expect(publicHomepageLink).toHaveAttribute("href", `/cloud-pets/${petNo}`);
  await expect(publicHomepageLink).toHaveAttribute("target", "_blank");
  await expect(publicHomepageLink).toHaveAttribute("rel", "noopener noreferrer");

  const publicPagePromise = page.waitForEvent("popup");
  await publicHomepageLink.click();
  const publicPage = await publicPagePromise;
  try {
    await publicPage.getByTestId("pet-public-profile").waitFor({ state: "visible" });
    await expect(publicPage.getByTestId("pet-public-pet-no")).toHaveText(petNo);
    await expect(publicPage.locator("body")).not.toContainText(phone);
    const publicPayloadResponse = await request.get(`${API_BASE}/cloud-pets/${petNo}`);
    expect(publicPayloadResponse.ok()).toBeTruthy();
    const publicPayload = await publicPayloadResponse.json();
    expect(publicPayload).not.toHaveProperty("ownerName");
    expect(publicPayload).not.toHaveProperty("ownerPhone");
    await expect(page).toHaveURL(/species=dog/);
    expect(new URL(page.url()).searchParams.get("petNo")).toBe(petNo);
    await expect(detail).toContainText(petName);
  } finally {
    await publicPage.close();
  }
});

test("admin cloud pet risk reasons stay consistent between list and detail", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Risk Reason Owner ${runId}`;
  const phone = `133${runId}`;
  const petName = `Risk Reason Pet ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "cat",
      personality: "Provides a deliberately incomplete care signal."
    },
    headers: { "X-Member-Token": member.sessionToken }
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(petNo);
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-risk").selectOption("high");
  await expect(
    cloudPetSection
      .getByTestId("admin-cloud-pet-filter-risk-reason")
      .locator('option[value="care_incomplete_today"]')
  ).toHaveText(/今日照护未完成（[1-9]\d*）/);
  await cloudPetSection
    .getByTestId("admin-cloud-pet-filter-risk-reason")
    .selectOption("care_incomplete_today");
  await cloudPetSection.getByTestId("admin-cloud-pet-sort-risk").selectOption("risk_desc");

  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${petNo}`)
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
  );
  await expect(listItem).toBeVisible();
  const listRisk = listItem.getByTestId("admin-cloud-pet-list-risk");
  await expect(listRisk).toContainText("今日照护未完成");
  await listItem.getByTestId("admin-cloud-pet-detail-open").click();

  const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
  await expect(detail.getByTestId("admin-cloud-pet-risk-signals")).toContainText(
    "今日照护未完成"
  );
});

test("admin can refresh cloud pet operations after a member care update", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Refresh Owner ${runId}`;
  const phone = `135${runId}`;
  const petName = `Refresh Pet ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const headers = { "X-Member-Token": member.sessionToken };
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "cat",
      personality: "Provides a manual-refresh operational sample."
    },
    headers
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-last-refresh")
  ).toContainText("最近更新：");
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(petNo);
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-risk").selectOption("high");
  await cloudPetSection
    .getByTestId("admin-cloud-pet-filter-risk-reason")
    .selectOption("care_incomplete_today");

  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${petNo}`)
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
  );
  await expect(listItem).toBeVisible();

  const careResponse = await request.post(
    `${API_BASE}/cloud-pets/${petNo}/growth-tasks/daily-care/complete`,
    { headers }
  );
  expect(careResponse.ok()).toBeTruthy();

  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes(`q=${petNo}`)
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-refresh").click();
  expect((await refreshResponse).ok()).toBeTruthy();

  await expect(listItem).toHaveCount(0);
  await expect(
    cloudPetSection
      .getByTestId("admin-cloud-pet-filter-risk-reason")
      .locator('option[value="care_incomplete_today"]')
  ).toHaveText("今日照护未完成（0）");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-filter-q")
  ).toHaveValue(petNo);
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-last-refresh")
  ).toContainText("最近更新：");
});

test("admin cloud pet structured filters restore from the URL", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `URL Filter Owner ${runId}`;
  const phone = `134${runId}`;
  const petName = `URL Filter Pet ${runId}`;
  const member = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
    data: {
      ownerName,
      ownerPhone: phone,
      name: petName,
      species: "cat",
      personality: "Provides a stable structured-filter URL fixture."
    },
    headers: { "X-Member-Token": member.sessionToken }
  });
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-species").selectOption("cat");
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-risk").selectOption("high");
  await cloudPetSection
    .getByTestId("admin-cloud-pet-filter-risk-reason")
    .selectOption("care_incomplete_today");
  await cloudPetSection.getByTestId("admin-cloud-pet-sort-risk").selectOption("risk_desc");

  const filterResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/cloud-pets?") &&
      response.url().includes("species=cat")
  );
  await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
  expect((await filterResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/species=cat/);

  const filteredUrl = new URL(page.url());
  expect(filteredUrl.searchParams.get("species")).toBe("cat");
  expect(filteredUrl.searchParams.get("riskLevel")).toBe("high");
  expect(filteredUrl.searchParams.get("riskReason")).toBe("care_incomplete_today");
  expect(filteredUrl.searchParams.get("riskSort")).toBe("risk_desc");
  await expect(
    cloudPetSection
      .getByTestId("admin-cloud-pet-filter-risk-reason")
      .locator('option[value="care_incomplete_today"]')
  ).toHaveText(/今日照护未完成（[1-9]\d*）/);

  const listItem = cloudPetSection.locator(
    `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
  );
  await expect(listItem).toBeVisible();
  await listItem.getByTestId("admin-cloud-pet-detail-open").click();
  await expect(cloudPetSection.getByTestId("admin-cloud-pet-detail")).toContainText(petName);
  expect(new URL(page.url()).searchParams.get("petNo")).toBe(petNo);
  expect(new URL(page.url()).searchParams.get("riskReason")).toBe(
    "care_incomplete_today"
  );

  await page.reload();
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await expect(cloudPetSection.getByTestId("admin-cloud-pet-filter-species")).toHaveValue("cat");
  await expect(cloudPetSection.getByTestId("admin-cloud-pet-filter-risk")).toHaveValue("high");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-filter-risk-reason")
  ).toHaveValue("care_incomplete_today");
  await expect(cloudPetSection.getByTestId("admin-cloud-pet-sort-risk")).toHaveValue("risk_desc");
  await expect(cloudPetSection.getByTestId("admin-cloud-pet-detail")).toContainText(petName);
  await expect(
    cloudPetSection.locator(
      `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${petNo}"]`
    )
  ).toBeVisible();

  await page.evaluate(() => window.history.pushState({}, "", "/admin"));
  await page.goBack();
  await expect(page).toHaveURL(/riskReason=care_incomplete_today/);
  await expect(
    page.locator("#admin-cloud-pets").getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();
  await expect(
    page.locator("#admin-cloud-pets").getByTestId("admin-cloud-pet-filter-risk-reason")
  ).toHaveValue("care_incomplete_today");
  await expect(
    page.locator("#admin-cloud-pets").getByTestId("admin-cloud-pet-detail")
  ).toContainText(petName);
  expect(new URL(page.url()).searchParams.get("petNo")).toBe(petNo);
  await page.locator("#admin-cloud-pets").getByTestId("admin-cloud-pet-detail-close").click();
  await expect(
    page.locator("#admin-cloud-pets").getByTestId("admin-cloud-pet-detail")
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("petNo")).toBeNull();
});

test("admin can patrol adjacent cloud pet details in the rendered order", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const member = await loginAsVerifiedMember(request, {
    name: `Patrol Owner ${runId}`,
    phone: `135${runId}`
  });

  for (const [index, name] of ["Patrol First", "Patrol Second", "Patrol Third"].entries()) {
    const petResponse = await request.post(`${API_BASE}/cloud-pets`, {
      data: {
        ownerName: `Patrol Owner ${runId}`,
        ownerPhone: `135${runId}`,
        name: `${name} ${runId}`,
        species: "cat",
        personality: `Provides adjacent detail patrol fixture ${index}.`
      },
      headers: { "X-Member-Token": member.sessionToken }
    });
    expect(petResponse.ok()).toBeTruthy();
  }

  await loginAsAdmin(page, "owner");
  const cloudPetSection = page.locator("#admin-cloud-pets");
  await expect(
    cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics")
  ).toBeVisible();

  const listItems = cloudPetSection.getByTestId("admin-cloud-pet-list-item");
  await expect.poll(() => listItems.count()).toBeGreaterThan(2);
  const firstListItem = listItems.nth(0);
  const secondListItem = listItems.nth(1);
  const firstPetNo = await firstListItem.getAttribute("data-pet-no");
  const secondPetNo = await secondListItem.getAttribute("data-pet-no");
  expect(firstPetNo).toBeTruthy();
  expect(secondPetNo).toBeTruthy();

  await firstListItem.getByTestId("admin-cloud-pet-detail-open").click();
  const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId("admin-cloud-pet-position")).toHaveText(
    /^第 1 \/ \d+ 只$/
  );
  await expect(
    detail.getByTestId("admin-cloud-pet-previous")
  ).toBeDisabled();
  await expect(detail.getByTestId("admin-cloud-pet-next")).toBeEnabled();
  expect(new URL(page.url()).searchParams.get("petNo")).toBe(firstPetNo);

  const nextDetailResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/cloud-pets/${secondPetNo}/detail`) &&
      response.ok()
  );
  await detail.getByTestId("admin-cloud-pet-next").click();
  await nextDetailResponse;
  await expect(detail.getByTestId("admin-cloud-pet-position")).toHaveText(
    /^第 2 \/ \d+ 只$/
  );
  expect(new URL(page.url()).searchParams.get("petNo")).toBe(secondPetNo);

  await detail.getByTestId("admin-cloud-pet-previous").click();
  await expect(detail.getByTestId("admin-cloud-pet-position")).toHaveText(
    /^第 1 \/ \d+ 只$/
  );
  expect(new URL(page.url()).searchParams.get("petNo")).toBe(firstPetNo);
});
