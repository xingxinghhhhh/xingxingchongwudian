import { expect, test } from "@playwright/test";
import {
  isolateMemberAuthTestClient,
  loginAsVerifiedMember,
  verifyMemberInCloudPetWorkspace
} from "./helpers/member-auth";

test.describe("cloud pet mobile smoke", () => {
  test.use({
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });

  test("cloud pet workspace has a mobile launch smoke path", async ({ page }) => {
    const runId = Date.now().toString().slice(-8);
    const ownerName = `Mobile Owner ${runId}`;
    const phone = `138${runId}`;
    const petName = `Mobile Pet ${runId}`;

    await page.goto("/cloud-pets");
    await expect(page.getByTestId("cloud-member-sync")).toBeVisible();

    await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
    await expect(page.getByText(phone)).toBeVisible();

    await page.getByTestId("cloud-create-pet-name").fill("   ");
    await page.getByTestId("cloud-create-personality").fill("   ");
    await expect(page.getByTestId("cloud-create-submit")).toBeDisabled();
    await page.getByTestId("cloud-create-pet-name").fill(petName);
    await page.getByTestId("cloud-create-species").selectOption("dog");
    await page.getByTestId("cloud-create-personality").fill("Mobile-friendly care loop verification.");
    await page.getByTestId("cloud-create-submit").click();

    await expect(page.getByText(petName).first()).toBeVisible();
    await expect(page.getByTestId("cloud-daily-panel")).toBeVisible();
    await expect(page.getByTestId("cloud-diary-archive")).toBeVisible();
    await expect(page.getByTestId("cloud-community-submit")).toBeVisible();

    await page.getByTestId("cloud-open-full-diary").click();
    await expect(page).toHaveURL(/\/cloud-pets\/.+/);
    await expect(page.getByTestId("pet-public-care-signal")).toBeVisible();
  });
});

test("cloud pet workspace guides a synced member without pets into first pet creation", async ({ page }) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `First Owner ${runId}`;
  const phone = `136${runId}`;
  const petName = `First Pet ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });

  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByTestId("cloud-first-pet-empty")).toBeVisible();
  await page.getByTestId("cloud-empty-create-cta").click();
  await expect(page).toHaveURL(/#cloud-create-pet$/);
  await expect(page.getByTestId("cloud-create-section")).toBeVisible();

  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("dog");
  await page.getByTestId("cloud-create-personality").fill("First pet onboarding smoke path.");
  await page.getByTestId("cloud-create-submit").click();

  await expect(page.getByText(petName).first()).toBeVisible();
  await expect(page.getByTestId("cloud-daily-panel")).toBeVisible();
  await expect(page.getByTestId("cloud-revisit-reminders")).toBeVisible();
  await expect(page.getByTestId("cloud-reminder-action-daily-care")).toHaveAttribute("href", "#cloud-daily-care");
  await expect(page.getByTestId("cloud-today-diary-missing")).toBeVisible();
  await page.getByTestId("cloud-start-care-from-diary").click();
  await expect(page).toHaveURL(/#cloud-daily-care$/);
  await expect(page.getByTestId("cloud-daily-care-tasks")).toBeVisible();
  await expect(page.getByTestId("cloud-task-complete-daily-care")).toBeEnabled();
  await page.getByTestId("cloud-task-complete-daily-care").click();
  await expect(page.getByTestId("cloud-today-completed-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-today-diary-present")).toBeVisible();
  await expect(page.getByTestId("cloud-latest-diary")).toBeVisible();
  await expect(page.getByTestId("cloud-reminder-action-share-homepage")).toHaveAttribute("href", /\/cloud-pets\//);
  await expect(page.getByTestId("cloud-reminder-action-share-community")).toHaveAttribute("href", "#community");
  await page.getByTestId("cloud-reminder-action-share-community").click();
  await expect(page).toHaveURL(/#community$/);
  await expect(page.getByTestId("cloud-community-body")).toHaveValue(/今天照顾了.*成长日记/);
  await page.getByTestId("cloud-community-submit").click();
  await expect(page.getByText(/今天照顾了.*成长日记/).first()).toBeVisible();
  await expect(page.getByTestId("cloud-reminder-action-view-community")).toHaveAttribute("href", "#community");
  await expect(page.getByTestId("cloud-reminder-action-share-community")).toHaveCount(0);
  await expect(page.getByTestId("cloud-next-action-open-homepage")).toBeVisible();
  await page.getByTestId("cloud-next-action-open-homepage").click();
  await expect(page).toHaveURL(/\/cloud-pets\/.+/);
  await expect(page.getByTestId("pet-public-care-signal")).toBeVisible();
  await expect(page.getByTestId("pet-public-share-card")).toBeVisible();
  await expect(page.getByTestId("pet-public-share-url")).toContainText("/cloud-pets/");
  await expect(page.getByTestId("pet-public-visit-count")).toContainText("次主页访问");
  await expect(page.getByTestId("pet-public-create-own")).toHaveAttribute("href", "/cloud-pets");
  await expect(page.getByTestId("pet-public-owner-view")).toBeVisible();
  await expect(page.getByTestId("pet-public-owner-workspace")).toHaveAttribute("href", "/cloud-pets");
  const publicPetUrl = page.url();
  await page.getByTestId("pet-public-owner-workspace").click();
  await expect(page).toHaveURL(/\/cloud-pets$/);
  await page.getByTestId("cloud-member-logout").click();
  await expect(page.getByTestId("cloud-member-profile")).toHaveCount(0);
  await page.goto(publicPetUrl);
  await expect(page.getByTestId("pet-public-owner-view")).toHaveCount(0);
});

test("member can withdraw their own community post from the cloud pet workspace", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Withdraw Owner ${runId}`;
  const phone = `135${runId}`;
  const petName = `Withdraw Pet ${runId}`;
  const communityBody = `Withdrawable community update ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await expect(page.getByText(phone)).toBeVisible();
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("cat");
  await page.getByTestId("cloud-create-personality").fill("Member withdrawal UI coverage.");
  await page.getByTestId("cloud-create-submit").click();

  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  await expect(page.getByTestId("cloud-community-submit")).toBeEnabled();
  await expect(page.getByTestId("cloud-community-body")).toBeEnabled();
  await page.getByTestId("cloud-community-body").fill(communityBody);
  await page.getByTestId("cloud-community-submit").click();

  const createdPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: communityBody });
  await expect(createdPost).toBeVisible();
  await expect(createdPost.getByTestId("cloud-community-withdraw")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await createdPost.getByTestId("cloud-community-withdraw").click();
  await expect(createdPost).toHaveCount(0);

  const feedResponse = await request.get("http://localhost:3000/api/community/posts");
  expect(feedResponse.ok()).toBeTruthy();
  const feedBody = (await feedResponse.json()) as {
    items: Array<{ body: string }>;
  };
  expect(feedBody.items.some((item) => item.body === communityBody)).toBe(false);
});

test("member can withdraw their own community comment from post detail", async ({
  page
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Comment Withdraw Owner ${runId}`;
  const phone = `136${runId}`;
  const petName = `Comment Pet ${runId}`;
  const postBody = `Comment detail post ${runId}`;
  const commentBody = `Comment to withdraw ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await expect(page.getByText(phone)).toBeVisible();
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("cat");
  await page.getByTestId("cloud-create-personality").fill("Comment ownership UI coverage.");
  await page.getByTestId("cloud-create-submit").click();
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  await expect(page.getByTestId("cloud-community-submit")).toBeEnabled();
  await page.getByTestId("cloud-community-body").fill(postBody);
  await page.getByTestId("cloud-community-submit").click();

  const createdPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(createdPost).toBeVisible();
  await createdPost.getByTestId("cloud-community-open-detail").click();
  await expect(page).toHaveURL(/\/community\/posts\/POST/);
  await expect(page.getByTestId("community-post-detail-body")).toContainText(postBody);
  await page.getByTestId("community-post-detail-comment-body").fill(commentBody);
  await page.getByTestId("community-post-detail-comment-submit").click();
  await expect(page.getByTestId("community-post-detail-comment")).toContainText(commentBody);

  await page.reload();
  const detailComment = page
    .getByTestId("community-post-detail-comment")
    .filter({ hasText: commentBody });
  await expect(detailComment).toBeVisible();
  await expect(detailComment.getByTestId("community-post-detail-comment-withdraw")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await detailComment.getByTestId("community-post-detail-comment-withdraw").click();
  await expect(detailComment).toHaveCount(0);
  await expect(page.getByTestId("community-post-detail-comments-empty")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("community-post-detail-comments-empty")).toBeVisible();
});

test("member can edit their own community post from post detail", async ({
  page
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Post Edit Owner ${runId}`;
  const phone = `135${runId}`;
  const petName = `Post Edit Pet ${runId}`;
  const postBody = `Original editable post ${runId}`;
  const updatedBody = `Updated editable post ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("cat");
  await page.getByTestId("cloud-create-personality").fill("Post edit UI coverage.");
  await page.getByTestId("cloud-create-submit").click();
  await expect(page.getByTestId("cloud-community-submit")).toBeEnabled();
  await page.getByTestId("cloud-community-body").fill(postBody);
  await page.getByTestId("cloud-community-submit").click();

  const createdPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(createdPost).toBeVisible();
  await createdPost.getByTestId("cloud-community-open-detail").click();
  await expect(page).toHaveURL(/\/community\/posts\/POST/);
  await expect(page.getByTestId("community-post-detail-edit")).toBeVisible();

  await page.getByTestId("community-post-detail-edit").click();
  await page.getByTestId("community-post-detail-edit-body").fill(updatedBody);
  await page.getByTestId("community-post-detail-edit-save").click();
  await expect(page.getByTestId("community-post-detail-body")).toContainText(updatedBody);
  await expect(page.getByTestId("community-post-detail-status")).toContainText("帖子已更新");

  await page.reload();
  await expect(page.getByTestId("community-post-detail-body")).toContainText(updatedBody);
  await expect(page.getByTestId("community-post-detail-edit")).toBeVisible();
});

test("member can report a community post from stable post detail", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Detail Report Owner ${runId}`;
  const phone = `133${runId}`;
  const petName = `Detail Report Pet ${runId}`;
  const postBody = `Detail report post ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("dog");
  await page.getByTestId("cloud-create-personality").fill("Stable detail report verification.");
  await page.getByTestId("cloud-create-submit").click();
  await expect(page.getByTestId("cloud-community-submit")).toBeEnabled();
  await page.getByTestId("cloud-community-body").fill(postBody);
  await page.getByTestId("cloud-community-submit").click();

  const createdPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(createdPost).toBeVisible();
  await createdPost.getByTestId("cloud-community-open-detail").click();
  await expect(page).toHaveURL(/\/community\/posts\/POST/);
  const postNo = new URL(page.url()).pathname.split("/").pop() as string;
  await expect(page.getByTestId("community-post-detail-body")).toContainText(postBody);

  const reportReason = page.getByTestId("community-post-detail-report-reason");
  await expect(reportReason).toBeEnabled();
  await reportReason.selectOption({ index: 1 });
  const selectedReportReason = await reportReason.inputValue();
  const reportRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().includes("/api/community/posts/") &&
      request.url().endsWith("/reports")
  );
  await page.getByTestId("community-post-detail-report-submit").click();
  const reportRequest = await reportRequestPromise;
  expect(reportRequest.postDataJSON()).toEqual({ reason: selectedReportReason });
  await expect(page.getByTestId("community-post-detail-status")).toContainText(
    "举报已进入商家审核队列"
  );
  await expect(page.getByTestId("community-post-detail-body")).toContainText(postBody);

  const adminReportsResponse = await request.get(
    `http://localhost:3000/api/admin/community/reports?status=pending_review&postNo=${encodeURIComponent(postNo)}`,
    { headers: { "X-Admin-Token": "dev-admin-key" } }
  );
  expect(adminReportsResponse.ok()).toBeTruthy();
  const adminReports = await adminReportsResponse.json();
  expect(adminReports.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        postNo,
        reason: selectedReportReason,
        status: "pending_review"
      })
    ])
  );

  await page.getByTestId("community-post-detail-report-submit").click();
  await expect(page.getByTestId("community-post-detail-status")).toContainText(
    "举报已更新到商家审核队列"
  );

  await page.reload();
  await expect(page.getByTestId("community-post-detail-body")).toContainText(postBody);
  await expect(page.getByTestId("community-post-detail-report-submit")).toBeVisible();
});

test("member can edit their own community comment from post detail", async ({
  page
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Comment Edit Owner ${runId}`;
  const phone = `134${runId}`;
  const petName = `Comment Edit Pet ${runId}`;
  const postBody = `Comment edit post ${runId}`;
  const commentBody = `Original comment ${runId}`;
  const updatedCommentBody = `Updated comment ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("dog");
  await page.getByTestId("cloud-create-personality").fill("Comment edit UI coverage.");
  await page.getByTestId("cloud-create-submit").click();
  await expect(page.getByTestId("cloud-community-submit")).toBeEnabled();
  await page.getByTestId("cloud-community-body").fill(postBody);
  await page.getByTestId("cloud-community-submit").click();

  const createdPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(createdPost).toBeVisible();
  await createdPost.getByTestId("cloud-community-open-detail").click();
  await expect(page).toHaveURL(/\/community\/posts\/POST/);
  await page.getByTestId("community-post-detail-comment-body").fill(commentBody);
  await page.getByTestId("community-post-detail-comment-submit").click();

  await page.reload();
  const detailComment = page
    .getByTestId("community-post-detail-comment")
    .filter({ hasText: commentBody });
  await expect(detailComment).toBeVisible();
  await expect(detailComment.getByTestId("community-post-detail-comment-edit")).toBeVisible();
  await expect(detailComment.getByTestId("community-post-detail-comment-withdraw")).toBeVisible();

  await detailComment.getByTestId("community-post-detail-comment-edit").click();
  await page.getByTestId("community-post-detail-comment-edit-body").fill(updatedCommentBody);
  await page.getByTestId("community-post-detail-comment-edit-save").click();
  await expect(page.getByTestId("community-post-detail-comment")).toContainText(updatedCommentBody);
  await expect(page.getByTestId("community-post-detail-status")).toContainText("评论已更新");
  await expect(page).toHaveURL(/\/community\/posts\/POST/);

  await page.reload();
  const updatedComment = page
    .getByTestId("community-post-detail-comment")
    .filter({ hasText: updatedCommentBody });
  await expect(updatedComment).toBeVisible();
  await expect(updatedComment.getByTestId("community-post-detail-comment-edit")).toBeVisible();
});

test("cloud pet workspace requires a live session after logout", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Saved Owner ${runId}`;
  const phone = `137${runId}`;
  const petName = `Saved Pet ${runId}`;

  await page.goto("/cloud-pets");
  await verifyMemberInCloudPetWorkspace(page, { name: ownerName, phone });
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByTestId("cloud-create-owner-name")).toHaveAttribute("maxlength", "40");
  await expect(page.getByTestId("cloud-create-owner-phone")).toHaveAttribute("maxlength", "11");
  await expect(page.getByTestId("cloud-create-owner-phone")).toHaveAttribute("pattern", "1[3-9][0-9]{9}");
  await expect(page.getByTestId("cloud-create-pet-name")).toHaveAttribute("maxlength", "24");
  await expect(page.getByTestId("cloud-create-personality")).toHaveAttribute("maxlength", "80");
  await expect(page.getByTestId("cloud-community-pulse")).toBeVisible();
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("0");
  await expect(page.getByTestId("cloud-create-owner-name")).toBeDisabled();
  await expect(page.getByTestId("cloud-create-owner-phone")).toBeDisabled();

  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("cat");
  await page.getByTestId("cloud-create-personality").fill("Restores from saved member identity.");
  await page.getByTestId("cloud-create-submit").click();
  await expect(page.getByText(petName).first()).toBeVisible();

  const sessionToken = await page.evaluate(() =>
    localStorage.getItem("kzt_member_session")
  );
  expect(sessionToken).toMatch(/^member_/);
  await page.getByTestId("cloud-member-logout").click();
  await expect(page.getByTestId("cloud-member-profile")).toHaveCount(0);
  await expect(page.getByTestId("cloud-member-sync")).toBeVisible();
  await expect(page.getByText(petName)).toHaveCount(0);
  await expect(page.getByTestId("cloud-daily-panel")).toHaveCount(0);
  await expect(page.getByTestId("cloud-create-owner-name")).toBeEnabled();
  await expect(page.getByTestId("cloud-create-owner-phone")).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_member_session"))
  ).toBeNull();
  const profile = await request.get(
    "http://localhost:3000/api/members/me",
    {
      headers: { "X-Member-Token": sessionToken! }
    }
  );
  expect(profile.status()).toBe(401);
  const sameContextProfileStatus = await page.evaluate(async (token) => {
    const response = await fetch("http://localhost:3000/api/members/me", {
      headers: { "X-Member-Token": token }
    });
    return response.status;
  }, sessionToken);
  expect(sameContextProfileStatus).toBe(401);

  await page.reload();

  await expect(page.getByTestId("cloud-member-profile")).toHaveCount(0);
  await expect(page.getByTestId("cloud-member-sync")).toBeVisible();
  await expect(page.getByTestId("cloud-create-owner-name")).toBeEnabled();
  await expect(page.getByTestId("cloud-create-owner-phone")).toBeEnabled();
  await expect(page.getByTestId("cloud-daily-panel")).toHaveCount(0);
});

test("cloud pet following feed is isolated when members switch", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const firstMember = {
    name: `Following Owner ${runId}`,
    phone: `135${runId}`
  };
  const secondMember = {
    name: `Following Other ${runId}`,
    phone: `134${runId}`
  };
  const firstLogin = await loginAsVerifiedMember(request, firstMember);
  const secondLogin = await loginAsVerifiedMember(request, secondMember);

  async function createPet(
    member: typeof firstMember,
    sessionToken: string,
    name: string
  ) {
    const response = await request.post("http://localhost:3000/api/cloud-pets", {
      data: {
        ownerName: member.name,
        ownerPhone: member.phone,
        name,
        species: "cat",
        personality: "Community following feed isolation verification."
      },
      headers: { "X-Member-Token": sessionToken }
    });
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<{ petNo: string }>;
  }

  const firstPet = await createPet(
    firstMember,
    firstLogin.sessionToken,
    `Following Pet ${runId}`
  );
  const secondPet = await createPet(
    secondMember,
    secondLogin.sessionToken,
    `Followed Pet ${runId}`
  );
  const followedPostBody = `Only the first member follows this post ${runId}`;
  const postResponse = await request.post(
    "http://localhost:3000/api/community/posts",
    {
      data: {
        petNo: secondPet.petNo,
        body: followedPostBody
      },
      headers: { "X-Member-Token": secondLogin.sessionToken }
    }
  );
  expect(postResponse.ok()).toBeTruthy();
  const followResponse = await request.post(
    `http://localhost:3000/api/community/pets/${secondPet.petNo}/follows`,
    {
      data: {},
      headers: { "X-Member-Token": firstLogin.sessionToken }
    }
  );
  expect(followResponse.ok()).toBeTruthy();

  await isolateMemberAuthTestClient(page, firstMember.phone);
  await page.addInitScript(
    ({ petNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", petNo);
    },
    { petNo: firstPet.petNo, sessionToken: firstLogin.sessionToken }
  );
  await page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  await page.getByTestId("cloud-feed-filter-following").click();
  await expect(page.getByText(followedPostBody)).toBeVisible();

  await page.getByTestId("cloud-member-logout").click();
  await expect(page.getByTestId("cloud-feed-filter-all")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("cloud-feed-filter-following")).toBeDisabled();

  await verifyMemberInCloudPetWorkspace(page, secondMember);
  await expect(page.getByText(secondMember.phone)).toBeVisible();
  await expect(page.getByTestId("cloud-feed-filter-following")).toBeEnabled();
  await page.getByTestId("cloud-feed-filter-following").click();
  await expect(page.getByTestId("cloud-community-post")).toHaveCount(0);
  await expect(page.getByTestId("cloud-community-feed-empty")).toHaveText(
    "还没有关注宠物的动态。"
  );
});

test("cloud pet public homepage keeps cross-member owner view isolated", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const memberA = {
    name: `Public Isolation A ${runId}`,
    phone: `133${runId}`
  };
  const memberB = {
    name: `Public Isolation B ${runId}`,
    phone: `134${runId}`
  };
  const loginA = await loginAsVerifiedMember(request, memberA);
  const loginB = await loginAsVerifiedMember(request, memberB);

  expect(loginA.sessionToken).not.toBe(loginB.sessionToken);

  async function createPet(
    member: typeof memberA,
    sessionToken: string,
    name: string
  ) {
    const response = await request.post("http://localhost:3000/api/cloud-pets", {
      data: {
        ownerName: member.name,
        ownerPhone: member.phone,
        name,
        species: "cat",
        personality: "Public homepage cross-member isolation verification."
      },
      headers: { "X-Member-Token": sessionToken }
    });
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<{ petNo: string; name: string }>;
  }

  const petA = await createPet(memberA, loginA.sessionToken, `Public Pet A ${runId}`);
  const petB = await createPet(memberB, loginB.sessionToken, `Public Pet B ${runId}`);

  await isolateMemberAuthTestClient(page, memberB.phone);
  await page.addInitScript(
    ({ petNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", petNo);
    },
    { petNo: petB.petNo, sessionToken: loginB.sessionToken }
  );

  await page.goto(`/cloud-pets/${petA.petNo}`);
  await expect(page.getByTestId("pet-public-profile")).toBeVisible();
  await expect(page.getByTestId("pet-public-owner-view")).toHaveCount(0);
  await expect(page.getByTestId("pet-public-owner-workspace")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(memberA.name);

  await page.reload();
  await expect(page.getByTestId("pet-public-profile")).toBeVisible();
  await expect(page.getByTestId("pet-public-owner-view")).toHaveCount(0);

  await page.goto(`/cloud-pets/${petB.petNo}`);
  await expect(page.getByTestId("pet-public-owner-view")).toBeVisible();
  await expect(page.getByTestId("pet-public-owner-workspace")).toHaveAttribute(
    "href",
    "/cloud-pets"
  );
});

test("cloud pet workspace clears an invalid saved member session", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("kzt_member_session", "member_invalid_ui_session");
    localStorage.setItem("kzt_active_cloud_pet", "VP_INVALID_UI");
  });

  await page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-member-sync")).toBeVisible();
  await expect(page.getByTestId("cloud-workspace-status")).toContainText(
    "登录状态已失效，请重新获取验证码"
  );
  await expect(page.getByTestId("cloud-workspace-recovery-error")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_member_session"))
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"))
  ).toBeNull();
});

test("cloud pet workspace clears private state when a live interaction session expires", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const member = {
    name: `Expired Action Owner ${runId}`,
    phone: `133${runId}`
  };
  const login = await loginAsVerifiedMember(request, member);
  const petResponse = await request.post(
    "http://localhost:3000/api/cloud-pets",
    {
      data: {
        ownerName: member.name,
        ownerPhone: member.phone,
        name: `Expired Pet ${runId}`,
        species: "dog",
        personality: "Verifies live session expiry during a community action."
      },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;
  const postBody = `Expired action post ${runId}`;
  const postResponse = await request.post(
    "http://localhost:3000/api/community/posts",
    {
      data: { petNo, body: postBody },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(postResponse.ok()).toBeTruthy();

  await isolateMemberAuthTestClient(page, member.phone);
  await page.addInitScript(
    ({ activePetNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", activePetNo);
    },
    { activePetNo: petNo, sessionToken: login.sessionToken }
  );
  await page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  const targetPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(targetPost).toBeVisible();

  const logoutResponse = await request.post(
    "http://localhost:3000/api/auth/logout",
    { headers: { "X-Member-Token": login.sessionToken } }
  );
  expect(logoutResponse.ok()).toBeTruthy();
  await targetPost.getByTestId("cloud-like-submit").click();

  await expect(page.getByTestId("cloud-member-profile")).toHaveCount(0);
  await expect(page.getByTestId("cloud-member-sync")).toBeVisible();
  await expect(page.getByTestId("cloud-daily-panel")).toHaveCount(0);
  await expect(page.getByTestId("cloud-workspace-status")).toContainText(
    "登录状态已失效，请重新获取验证码"
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_member_session"))
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"))
  ).toBeNull();
});

test("cloud pet workspace retries a temporary profile failure without logout", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Recovery Owner ${runId}`;
  const phone = `130${runId}`;
  const login = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const petResponse = await request.post(
    "http://localhost:3000/api/cloud-pets",
    {
      data: {
        ownerName,
        ownerPhone: phone,
        name: `Recovery Pet ${runId}`,
        species: "cat",
        personality: "Restores after a temporary member profile failure."
      },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;

  let shouldFailProfile = true;
  await page.route("**/api/members/me", async (route) => {
    if (
      route.request().method() === "GET" &&
      shouldFailProfile
    ) {
      shouldFailProfile = false;
      await route.fulfill({
        body: JSON.stringify({ message: "Temporary profile failure" }),
        contentType: "application/json",
        status: 503
      });
      return;
    }
    await route.continue();
  });
  await page.addInitScript(
    ({ activePetNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", activePetNo);
    },
    { activePetNo: petNo, sessionToken: login.sessionToken }
  );

  await page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-workspace-recovery-error")).toBeVisible();
  await expect(page.getByTestId("cloud-workspace-recovery-error")).toContainText(
    "会员工作台同步失败，请稍后重试"
  );
  await expect(page.getByTestId("cloud-member-sync")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_member_session"))
  ).toBe(login.sessionToken);
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"))
  ).toBe(petNo);

  await page.getByTestId("cloud-workspace-retry").click();
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    petNo
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_member_session"))
  ).toBe(login.sessionToken);
});

test("cloud pet workspace switches pets without stale scoped data", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Multi Pet Owner ${runId}`;
  const phone = `136${runId}`;
  const login = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });

  async function createPet(name: string, species: "cat" | "dog") {
    const response = await request.post("http://localhost:3000/api/cloud-pets", {
      data: {
        ownerName,
        ownerPhone: phone,
        name,
        species,
        personality: `${name} has a distinct daily care routine.`
      },
      headers: { "X-Member-Token": login.sessionToken }
    });
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<{ petNo: string }>;
  }

  const firstPet = await createPet(`First Pet ${runId}`, "cat");
  const secondPet = await createPet(`Second Pet ${runId}`, "dog");
  const careResponse = await request.post(
    `http://localhost:3000/api/cloud-pets/${firstPet.petNo}/growth-tasks/daily-care/complete`,
    { headers: { "X-Member-Token": login.sessionToken } }
  );
  expect(careResponse.ok()).toBeTruthy();

  let shouldDelayProfile = true;
  await page.route("**/api/members/me", async (route) => {
    if (shouldDelayProfile) {
      shouldDelayProfile = false;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await route.continue();
  });
  await page.addInitScript(
    ({ petNo, sessionToken }) => {
      if (!localStorage.getItem("kzt_member_session")) {
        localStorage.setItem("kzt_member_session", sessionToken);
        localStorage.setItem("kzt_active_cloud_pet", petNo);
      }
    },
    { petNo: firstPet.petNo, sessionToken: login.sessionToken }
  );

  const navigation = page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-workspace-loading")).toBeVisible();
  await expect(page.getByTestId("cloud-member-sync")).toHaveCount(0);
  await navigation;

  await expect(page.getByTestId("cloud-pet-switch")).toHaveCount(2);
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    firstPet.petNo
  );
  await expect(page.getByTestId("cloud-today-completed-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-today-diary-present")).toBeVisible();

  await page.getByTestId("cloud-diary-filter-owner").click();
  await expect(page.getByTestId("cloud-diary-filter-owner")).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.route("**/api/cloud-pets/*/recommendations", async (route) => {
    const isFirstPet = route.request().url().includes(firstPet.petNo);
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, isFirstPet ? 500 : 40));
    await route.fulfill({ response });
  });

  await page
    .getByTestId("cloud-pet-switch")
    .filter({ hasText: `Second Pet ${runId}` })
    .click();
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );
  await expect(page.getByTestId("cloud-diary-filter-all")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("cloud-today-completed-count")).toHaveText("0");
  await expect(page.getByTestId("cloud-today-diary-missing")).toBeVisible();
  await expect(page.getByTestId("cloud-care-diary-cta")).toHaveCount(0);
  await expect(page.getByTestId("cloud-recommendations-panel")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );

  const firstRecommendationRequest = page.waitForRequest((request) =>
    request.url().includes(
      `/api/cloud-pets/${firstPet.petNo}/recommendations`
    )
  );
  await page
    .getByTestId("cloud-pet-switch")
    .filter({ hasText: `First Pet ${runId}` })
    .click();
  await firstRecommendationRequest;
  await page
    .getByTestId("cloud-pet-switch")
    .filter({ hasText: `Second Pet ${runId}` })
    .click();

  await expect(page.getByTestId("cloud-recommendations-panel")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );
  await page.waitForTimeout(600);
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );
  await expect(page.getByTestId("cloud-recommendations-panel")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"))
  ).toBe(secondPet.petNo);

  await page.reload();
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    secondPet.petNo
  );
});

test("cloud pet recommendations recover without losing the active pet", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `Retry Owner ${runId}`;
  const phone = `134${runId}`;
  const login = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const createResponse = await request.post(
    "http://localhost:3000/api/cloud-pets",
    {
      data: {
        ownerName,
        ownerPhone: phone,
        name: `Retry Pet ${runId}`,
        species: "cat",
        personality: "Keeps the current workspace stable during a retry."
      },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(createResponse.ok()).toBeTruthy();
  const petNo = ((await createResponse.json()) as { petNo: string }).petNo;

  let recommendationAttempts = 0;
  await page.route(
    `**/api/cloud-pets/${petNo}/recommendations`,
    async (route) => {
      recommendationAttempts += 1;
      if (recommendationAttempts === 1) {
        await route.fulfill({
          body: JSON.stringify({ message: "Temporary recommendation failure" }),
          contentType: "application/json",
          status: 503
        });
        return;
      }
      await route.continue();
    }
  );
  await page.addInitScript(
    ({ activePetNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", activePetNo);
    },
    { activePetNo: petNo, sessionToken: login.sessionToken }
  );

  await page.goto("/cloud-pets");
  await expect(page.getByTestId("cloud-recommendations-error")).toBeVisible();
  await expect(page.getByTestId("cloud-active-pet-profile")).toHaveAttribute(
    "data-pet-no",
    petNo
  );

  await page.getByTestId("cloud-recommendations-retry").click();
  await expect(page.getByTestId("cloud-recommendations-error")).toHaveCount(0);
  await expect(page.getByTestId("cloud-recommendations-panel")).toHaveAttribute(
    "data-pet-no",
    petNo
  );
  expect(recommendationAttempts).toBe(2);
});

test("cloud pet community refresh preserves posts and recovers after a temporary failure", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const member = {
    name: `Community Recovery ${runId}`,
    phone: `132${runId}`
  };
  const login = await loginAsVerifiedMember(request, member);
  const petResponse = await request.post(
    "http://localhost:3000/api/cloud-pets",
    {
      data: {
        ownerName: member.name,
        ownerPhone: member.phone,
        name: `Recovery Pet ${runId}`,
        species: "cat",
        personality: "Keeps visible community content during a temporary refresh failure."
      },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(petResponse.ok()).toBeTruthy();
  const petNo = ((await petResponse.json()) as { petNo: string }).petNo;
  const postBody = `Community recovery post ${runId}`;
  const postResponse = await request.post(
    "http://localhost:3000/api/community/posts",
    {
      data: { petNo, body: postBody },
      headers: { "X-Member-Token": login.sessionToken }
    }
  );
  expect(postResponse.ok()).toBeTruthy();

  await isolateMemberAuthTestClient(page, member.phone);
  await page.addInitScript(
    ({ activePetNo, sessionToken }) => {
      localStorage.setItem("kzt_member_session", sessionToken);
      localStorage.setItem("kzt_active_cloud_pet", activePetNo);
    },
    { activePetNo: petNo, sessionToken: login.sessionToken }
  );
  await page.goto("/cloud-pets");
  const targetPost = page
    .getByTestId("cloud-community-post")
    .filter({ hasText: postBody });
  await expect(targetPost).toBeVisible();

  let shouldFailCommunity = true;
  await page.route("**/api/community/posts", async (route) => {
    if (shouldFailCommunity && route.request().method() === "GET") {
      await route.fulfill({
        body: JSON.stringify({ message: "Temporary community failure" }),
        contentType: "application/json",
        status: 503
      });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("cloud-member-refresh").click();
  await expect(page.getByTestId("cloud-community-error")).toBeVisible();
  await expect(targetPost).toBeVisible();
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();

  shouldFailCommunity = false;
  const recoveredResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/community/posts" &&
      response.request().method() === "GET" &&
      response.status() === 200
  );
  await page.getByTestId("cloud-community-retry").click();
  await recoveredResponse;
  await expect(page.getByTestId("cloud-community-loading")).toHaveCount(0);
  await expect(page.getByTestId("cloud-community-error")).toHaveCount(0);
  await expect(targetPost).toBeVisible();
});

test("missing public pet homepage returns a localized 404 without a visit", async ({
  page
}) => {
  let visitRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("/api/cloud-pets/VP_MISSING_PUBLIC_UI/homepage/visits")
    ) {
      visitRequestCount += 1;
    }
  });

  const response = await page.goto("/cloud-pets/VP_MISSING_PUBLIC_UI");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("pet-public-not-found")).toBeVisible();
  await expect(page.getByRole("heading", { name: "没有找到这只云养宠" }))
    .toBeVisible();
  await expect(
    page.getByRole("link", { name: "回到云养宠工作台" })
  ).toHaveAttribute("href", "/cloud-pets");
  await page.waitForTimeout(200);
  expect(visitRequestCount).toBe(0);
});

test("public homepage deduplicates daily visits from the same browser", async ({
  page,
  request
}) => {
  const runId = Date.now().toString().slice(-8);
  const phone = `135${runId}`;
  const ownerName = `Public Visitor Owner ${runId}`;
  const login = await loginAsVerifiedMember(request, {
    name: ownerName,
    phone
  });
  const sessionToken = login.sessionToken;
  const create = await request.post("http://localhost:3000/api/cloud-pets", {
    data: {
      ownerName,
      ownerPhone: phone,
      name: `Visit Pet ${runId}`,
      species: "cat",
      personality: "Verifies anonymous public homepage visit deduplication"
    },
    headers: { "X-Member-Token": sessionToken }
  });
  expect(create.ok()).toBeTruthy();
  const petNo = (await create.json()).petNo as string;
  const visitUrl = `/api/cloud-pets/${petNo}/homepage/visits`;

  const firstVisit = page.waitForResponse(
    (response) =>
      response.url().endsWith(visitUrl) &&
      response.request().method() === "POST"
  );
  await page.goto(`/cloud-pets/${petNo}`);
  expect((await firstVisit).status()).toBe(201);
  await expect(page.locator("body")).not.toContainText(ownerName);
  await expect(page.locator("body")).not.toContainText(phone);
  await expect(page.getByTestId("pet-public-owner-view")).toHaveCount(0);
  await expect(page.getByTestId("pet-public-owner-workspace")).toHaveCount(0);
  const firstVisitorId = await page.evaluate(() =>
    localStorage.getItem("kzt_homepage_visitor")
  );
  expect(firstVisitorId).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);

  const repeatedVisit = page.waitForResponse(
    (response) =>
      response.url().endsWith(visitUrl) &&
      response.request().method() === "POST"
  );
  await page.reload();
  expect((await repeatedVisit).status()).toBe(201);
  expect(
    await page.evaluate(() => localStorage.getItem("kzt_homepage_visitor"))
  ).toBe(firstVisitorId);

  const archive = await request.get(
    `http://localhost:3000/api/cloud-pets/${petNo}/homepage/archive`
  );
  expect(archive.ok()).toBeTruthy();
  expect((await archive.json()).engagement.homepageVisitCount).toBe(1);
});

test("cloud pet workspace supports the daily care loop", async ({ page }) => {
  const runId = Date.now().toString().slice(-8);
  const ownerName = `UI Owner ${runId}`;
  const phone = `139${runId}`;
  const petName = `Cloud Pet ${runId}`;
  const communityBody = `Today care note ${runId}`;
  const commentBody = `Today comment note ${runId}`;
  const diaryNoteBody = `Owner diary note ${runId}`;
  const editedDiaryNoteBody = `Edited owner diary note ${runId}`;

  await isolateMemberAuthTestClient(page, phone);
  await page.goto("/cloud-pets");

  await expect(page.getByTestId("cloud-member-name")).toHaveAttribute("maxlength", "40");
  await expect(page.getByTestId("cloud-member-phone")).toHaveAttribute("maxlength", "11");
  await expect(page.getByTestId("cloud-member-phone")).toHaveAttribute("pattern", "1[3-9][0-9]{9}");
  await page.getByTestId("cloud-member-name").fill("   ");
  await page.getByTestId("cloud-member-phone").fill("   ");
  await expect(page.getByTestId("cloud-member-sync")).toBeDisabled();
  await page.getByTestId("cloud-member-name").fill(ownerName);
  await page.getByTestId("cloud-member-phone").fill(phone);
  await page.getByTestId("cloud-member-request-code").click();
  await expect(page.getByTestId("cloud-member-code")).toHaveValue(/^\d{6}$/);
  await page.getByTestId("cloud-member-sync").click();
  await expect(page.getByText(phone)).toBeVisible();
  await expect(page.getByTestId("cloud-community-pulse")).toBeVisible();
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("0");
  await expect(page.getByTestId("cloud-create-owner-name")).toHaveAttribute("maxlength", "40");
  await expect(page.getByTestId("cloud-create-owner-phone")).toHaveAttribute("maxlength", "11");
  await expect(page.getByTestId("cloud-create-pet-name")).toHaveAttribute("maxlength", "24");
  await expect(page.getByTestId("cloud-create-personality")).toHaveAttribute("maxlength", "80");

  await page.getByTestId("cloud-create-pet-name").fill("   ");
  await page.getByTestId("cloud-create-personality").fill("   ");
  await expect(page.getByTestId("cloud-create-submit")).toBeDisabled();
  await page.getByTestId("cloud-create-pet-name").fill(petName);
  await page.getByTestId("cloud-create-species").selectOption("cat");
  await page.getByTestId("cloud-create-personality").fill("Curious, steady, and loves daily care rituals.");
  await page.getByTestId("cloud-create-submit").click();

  await expect(page.getByText(petName).first()).toBeVisible();
  await expect(page.getByTestId("cloud-daily-panel")).toBeVisible();
  await page.getByTestId("cloud-follow-pet").click();
  await expect(page.getByTestId("cloud-follow-signal")).toContainText("1 位关注者");
  await expect(page.getByTestId("cloud-community-following-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("1");
  await page.reload();
  await expect(page.getByTestId("cloud-member-profile")).toBeVisible();
  await page.getByTestId("cloud-follow-pet").click();
  await expect(page.getByTestId("cloud-follow-signal")).toContainText("1 位关注者");
  await expect(page.getByTestId("cloud-community-following-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("1");

  const dailyCareButton = page.getByTestId("cloud-task-complete-daily-care");
  await expect(dailyCareButton).toBeEnabled();
  await dailyCareButton.click();
  await expect(page.getByTestId("cloud-today-completed-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-care-diary-cta")).toBeVisible();
  await page.getByTestId("cloud-view-today-diary").click();
  await expect(page).toHaveURL(/#cloud-diary-archive$/);
  await expect(page.getByTestId("cloud-diary-filter-daily")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.locator('[data-testid="cloud-diary-entry"][data-diary-type="care_daily_diary"]')
  ).toBeVisible();
  const feedCareButton = page.getByTestId("cloud-task-complete-feed-care");
  await expect(feedCareButton).toBeEnabled();
  await feedCareButton.click();
  await expect(page.getByTestId("cloud-today-completed-count")).toHaveText("2");
  await expect(feedCareButton).toBeDisabled();
  await expect(page.getByTestId("cloud-care-streak")).toHaveText("1天");
  await expect(page.getByTestId("cloud-next-care-prompt")).toBeVisible();
  await expect(dailyCareButton).toBeDisabled();
  await expect(page.getByTestId("cloud-today-diary-present")).toBeVisible();
  await expect(page.getByTestId("cloud-latest-diary")).toBeVisible();
  await expect(page.getByTestId("cloud-diary-archive")).toBeVisible();
  await expect(page.getByTestId("cloud-diary-entry")).toHaveCount(1);
  await expect(page.getByTestId("cloud-care-diary-cta")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("cloud-care-diary-cta")).toBeVisible();
  await expect(
    page.locator('[data-testid="cloud-diary-entry"][data-diary-type="care_daily_diary"]')
  ).toBeVisible();
  await expect(page.getByTestId("cloud-diary-entry-source").first()).toHaveText("照顾记录");
  await expect(page.getByTestId("cloud-diary-entry-open-daily_diary").first()).toHaveAttribute("href", /archive=daily_diary#diary-/);
  await page.getByTestId("cloud-diary-entry-copy-daily_diary").first().click();
  await expect(page.getByTestId("cloud-workspace-status")).toContainText("公开归档链接");

  await page.getByTestId("cloud-diary-note-body").fill("   ");
  await expect(page.getByTestId("cloud-diary-note-submit")).toBeDisabled();
  await page.getByTestId("cloud-diary-note-body").fill(diaryNoteBody);
  await page.getByTestId("cloud-diary-note-submit").click();
  const ownerNoteEntry = page.getByTestId("cloud-diary-entry").filter({ hasText: diaryNoteBody });
  await expect(ownerNoteEntry).toBeVisible();
  await expect(ownerNoteEntry.getByTestId("cloud-diary-entry-source")).toHaveText("主人手记");
  await expect(page.getByTestId("cloud-diary-calendar")).toBeVisible();
  await expect(page.getByTestId("cloud-diary-calendar-day").first()).toContainText("今天");
  await expect(page.getByTestId("cloud-diary-calendar-day").first()).toContainText("2 条记录");
  await page.getByTestId("cloud-diary-calendar-day").first().click();
  await expect(page.getByTestId("cloud-diary-date-filter")).toContainText("正在查看");
  await expect(page.getByTestId("cloud-diary-entry")).toHaveCount(2);
  await page.getByTestId("cloud-diary-date-clear").click();
  await expect(page.getByTestId("cloud-diary-date-filter")).toHaveCount(0);
  await page.getByTestId("cloud-diary-filter-owner").click();
  await expect(page.getByTestId("cloud-diary-archive").getByText(diaryNoteBody).first()).toBeVisible();
  await expect(page.getByTestId("cloud-diary-entry")).toHaveCount(1);
  await expect(page.getByTestId("cloud-diary-entry-open-owner_note").first()).toHaveAttribute("href", /archive=owner_note#diary-/);
  await expect(page.getByTestId("cloud-diary-entry-copy-owner_note").first()).toBeVisible();
  await page.getByTestId("cloud-diary-filter-daily").click();
  await expect(page.getByTestId("cloud-diary-entry")).toHaveCount(1);
  await page.getByTestId("cloud-diary-filter-all").click();
  await page.getByTestId("cloud-diary-note-edit").first().click();
  await page.getByTestId("cloud-diary-note-edit-body").fill("   ");
  await expect(page.getByTestId("cloud-diary-note-save")).toBeDisabled();
  await page.getByTestId("cloud-diary-note-edit-body").fill(editedDiaryNoteBody);
  await page.getByTestId("cloud-diary-note-save").click();
  await expect(page.getByTestId("cloud-diary-archive").getByText(editedDiaryNoteBody).first()).toBeVisible();

  await page.getByTestId("cloud-homepage-headline").fill("   ");
  await page.getByTestId("cloud-homepage-story").fill("   ");
  await expect(page.getByTestId("cloud-homepage-save")).toBeDisabled();
  await page.getByTestId("cloud-homepage-headline").fill(`${petName} daily homepage`);
  await page.getByTestId("cloud-homepage-story").fill("The owner keeps a launch-ready care archive for this pet.");
  await page.getByTestId("cloud-homepage-save").click();
  await expect(page.getByTestId("cloud-homepage-save")).toBeEnabled();
  await page.getByTestId("cloud-homepage-copy-link").click();
  await expect(page.getByTestId("cloud-workspace-status")).toContainText("宠物主页链接");

  await expect(page.getByTestId("cloud-community-limit")).toContainText("/280 字");
  await page.getByTestId("cloud-community-body").fill("   ");
  await expect(page.getByTestId("cloud-community-submit")).toBeDisabled();
  await page.getByTestId("cloud-community-body").fill(communityBody);
  await page.getByTestId("cloud-community-submit").click();
  const createdCommunityPost = page.getByTestId("cloud-community-post").filter({ hasText: communityBody });
  await expect(createdCommunityPost).toBeVisible();
  await expect(createdCommunityPost).toHaveAttribute("id", /community-post-/);
  await expect(createdCommunityPost.getByText("关联讨论")).toBeHidden();
  const communityDetailLink = createdCommunityPost.getByTestId("cloud-community-open-detail");
  await expect(communityDetailLink).toHaveAttribute("href", /\/community\/posts\//);
  await communityDetailLink.click();
  await expect(page).toHaveURL(/\/community\/posts\/POST/);
  await expect(page.getByTestId("community-post-detail-body")).toContainText(communityBody);
  await expect(page.getByTestId("community-post-detail-comments-empty")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("community-post-detail-body")).toContainText(communityBody);
  await page.goBack();
  await expect(createdCommunityPost).toBeVisible();
  await createdCommunityPost.getByTestId("cloud-community-copy-link").click();
  await expect(page.getByTestId("cloud-workspace-status")).toContainText("社区动态链接");
  await expect(createdCommunityPost.getByTestId("cloud-community-comments-empty")).toBeVisible();
  await page.getByTestId("cloud-feed-filter-following").click();
  await expect(page.getByText(communityBody)).toBeVisible();
  await page.getByTestId("cloud-feed-filter-my-pet").click();
  await expect(page.getByText(communityBody)).toBeVisible();
  await page.getByTestId("cloud-feed-filter-all").click();
  await createdCommunityPost.getByTestId("cloud-like-submit").click();
  await expect(createdCommunityPost.getByTestId("cloud-community-metrics")).toContainText("1 点赞");
  await expect(page.getByTestId("cloud-community-liked-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("2");
  await createdCommunityPost.getByTestId("cloud-like-submit").click();
  await expect(createdCommunityPost.getByTestId("cloud-community-metrics")).toContainText("1 点赞");
  await expect(page.getByTestId("cloud-community-liked-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("2");
  await page.getByTestId("cloud-report-reason").first().selectOption({ index: 1 });
  const selectedReportReason = await page.getByTestId("cloud-report-reason").first().inputValue();
  const reportRequestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/api/community/posts/") && request.url().endsWith("/reports")
  );
  await page.getByTestId("cloud-report-submit").first().click();
  const reportRequest = await reportRequestPromise;
  expect(reportRequest.postDataJSON()).toMatchObject({ reason: selectedReportReason });
  await expect(page.getByTestId("cloud-report-submit").first()).toBeEnabled();
  await expect(page.getByTestId("cloud-community-report-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("3");
  await expect(page.getByTestId("cloud-workspace-status")).toContainText("举报已进入商家审核队列。");
  await page.getByTestId("cloud-report-submit").first().click();
  await expect(page.getByTestId("cloud-report-submit").first()).toBeEnabled();
  await expect(page.getByTestId("cloud-community-report-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("3");
  await expect(page.getByTestId("cloud-workspace-status")).toContainText("举报已更新到商家审核队列。");
  await expect(page.getByTestId("cloud-diary-archive").getByText(diaryNoteBody).first()).toBeVisible();
  await expect(page.getByTestId("cloud-comment-body").first()).toHaveAttribute("maxlength", "280");
  await page.getByTestId("cloud-comment-body").first().fill("   ");
  await expect(page.getByTestId("cloud-comment-submit").first()).toBeDisabled();
  await page.getByTestId("cloud-comment-body").first().fill(commentBody);
  await page.getByTestId("cloud-comment-submit").first().click();
  await expect(page.getByText(commentBody)).toBeVisible();
  await expect(createdCommunityPost.getByTestId("cloud-community-metrics")).toContainText("1 评论");
  await expect(page.getByTestId("cloud-community-comment-count")).toHaveText("1");
  await expect(page.getByTestId("cloud-community-signal-total")).toHaveText("4");

  await page.getByTestId("cloud-open-full-diary").click();
  await expect(page).toHaveURL(/\/cloud-pets\/.+archive=all/);
  const publicPetUrl = page.url().split("?")[0];
  await expect(page.getByTestId("pet-public-care-signal")).toContainText("2");
  await expect(page.getByTestId("pet-public-today-status")).toBeVisible();
  await expect(page.getByTestId("pet-public-today-diary-present")).toBeVisible();
  await expect(page.getByTestId("pet-public-today-diary-link")).toHaveAttribute("href", /archive=daily_diary#diary-/);
  await expect(page.getByTestId("pet-public-recent-diaries")).toBeVisible();
  await expect(page.getByTestId("pet-public-recent-diary-link").first()).toHaveAttribute("href", /archive=.+#diary-/);
  await expect(page.getByTestId("pet-public-open-archive")).toHaveAttribute("href", /archive=all/);
  await expect(page.getByTestId("pet-public-open-community")).toHaveAttribute("href", "#pet-public-community");
  await expect(page.getByTestId("pet-public-diary-calendar")).toBeVisible();
  await expect(page.getByTestId("pet-public-diary-calendar-link").first()).toHaveAttribute("href", /archive=all#diary-/);
  await expect(page.getByTestId("pet-public-archive-entry").first()).toBeVisible();
  await expect(page.getByTestId("pet-public-entry-link").first()).toHaveAttribute("href", /#diary-/);
  await expect(page.getByText("公开条目").first()).toBeHidden();
  await expect(page.getByTestId("pet-public-community-posts")).toBeVisible();
  await expect(page.getByTestId("pet-public-community-count")).toContainText("1 条公开动态");
  await expect(page.getByTestId("pet-public-community-engagement")).toContainText("2 次公开互动");
  await expect(page.getByTestId("pet-public-community-latest")).toContainText("最新动态");
  await expect(page.getByTestId("pet-public-community-join")).toHaveAttribute("href", "/cloud-pets#community");
  await expect(page.getByTestId("pet-public-community-discussion").first()).toHaveAttribute("href", /\/community\/posts\/POST/);
  await expect(page.getByTestId("pet-public-community-post-date").first()).toContainText("发布于");
  await expect(page.getByTestId("pet-public-community-comment").first()).toContainText(commentBody);
  await expect(page.getByText(communityBody)).toBeVisible();
  await expect(page.getByTestId("pet-public-recent-diaries").getByText(editedDiaryNoteBody).first()).toBeVisible();
  await page.getByTestId("pet-archive-filter-owner_note").click();
  await expect(page).toHaveURL(/archive=owner_note/);
  await expect(page.getByTestId("pet-public-recent-diaries").getByText(editedDiaryNoteBody).first()).toBeVisible();
  await page.getByTestId("pet-archive-filter-daily_diary").click();
  await expect(page).toHaveURL(/archive=daily_diary/);
  await expect(page.getByTestId("pet-public-today-diary-present")).toBeVisible();
  await page.goto(`${publicPetUrl}?archive=unsupported`);
  await expect(page.getByTestId("pet-archive-filter-all")).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByTestId("pet-public-archive-entry").first()).toBeVisible();
});
