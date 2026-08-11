import { expect, test, type APIRequestContext } from "@playwright/test";
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
  ).toHaveText("今日照护未完成（1）");
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
});
