import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const rootDir = resolve(import.meta.dirname, "..");
const apiEntry = resolve(rootDir, "dist/main.js");
const nextCli = resolve(rootDir, "node_modules/next/dist/bin/next");
const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
const adminOwnerBootstrapScript = resolve(rootDir, "scripts/bootstrap-admin-owner.mjs");
const schemaPath = resolve(rootDir, "prisma/schema.prisma");
const webhookToken = "cloud-pet-web-production-smoke-webhook-token";
const releaseId = "production-smoke-release";
const diaryEventTypes = [
  "daily_diary",
  "care_daily_diary",
  "presence_daily_diary"
];
const {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} = await import(
  pathToFileURL(resolve(rootDir, "dist/config/cloud-pet-config-fingerprint.js")).href
);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
    });
    child.once("error", () => rejectRun(new Error("Smoke command could not start")));
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with code ${code}\n${stderr}`));
    });
  });
}

async function getAvailablePort() {
  const server = createTcpServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolveClose) => server.close(resolveClose));
  assertSmoke(port, "Smoke port allocation failed");
  return port;
}

async function startVerificationWebhook(port) {
  const codes = new Map();
  const server = createHttpServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        if (
          request.method !== "POST" ||
          request.headers.authorization !== `Bearer ${webhookToken}`
        ) {
          response.writeHead(401).end();
          return;
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        assertSmoke(payload.phone && payload.code, "Webhook payload was incomplete");
        codes.set(payload.phone, payload.code);
        response.writeHead(204).end();
      } catch {
        response.writeHead(400).end();
      }
    });
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${port}/member-verification`,
    getCode: (phone) => codes.get(phone),
    close: () =>
      new Promise((resolveClose) => {
        if (!server.listening) resolveClose();
        else server.close(resolveClose);
      })
  };
}

function startProcess(command, args, env) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
  });
  return { child, getStderr: () => stderr };
}

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) return;
  processHandle.child.kill();
  const exited = once(processHandle.child, "exit");
  const timeout = new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000, "timeout"));
  if ((await Promise.race([exited, timeout])) === "timeout") {
    processHandle.child.kill("SIGKILL");
    await once(processHandle.child, "exit");
  }
}

function databaseUrl(databasePath) {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("API returned invalid JSON");
    }
  }
  return { response, body };
}

async function waitForApi(baseUrl, api) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error(`Production API exited before readiness\n${api.getStderr()}`);
    }
    try {
      const result = await requestJson(baseUrl, "/api/health/ready");
      if (result.response.ok && result.body?.status === "ready" && result.body?.database?.connected === true) return;
    } catch {
      // The API may still be binding its port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Production API readiness timed out\n${api.getStderr()}`);
}

async function waitForWeb(baseUrl, web) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (web.child.exitCode !== null) {
      throw new Error(`Production web exited before readiness\n${web.getStderr()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/cloud-pets`);
      const html = await response.text();
      if (response.ok && html.includes("<html")) return;
    } catch {
      // Next may still be binding its port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Production web readiness timed out\n${web.getStderr()}`);
}

async function waitForVerificationCode(webhook, phone) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const code = webhook.getCode(phone);
    if (code) return code;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Verification webhook did not receive the browser login code");
}

async function waitForLocatorText(locator, predicate, message) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const text = (await locator.textContent())?.trim() ?? "";
    if (predicate(text)) return text;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(message);
}

async function waitForLocatorCount(locator, predicate, message) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const count = await locator.count();
    if (predicate(count)) return count;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(message);
}

async function verifyOwnerLaunchReadiness(adminPage) {
  const launchCard = adminPage.getByTestId("admin-cloud-pet-launch-readiness");
  const deploymentCard = adminPage.getByTestId("admin-deployment-readiness");
  await launchCard.waitFor({ state: "visible" });
  await deploymentCard.waitFor({ state: "visible" });

  await waitForLocatorText(
    deploymentCard.getByTestId("admin-deployment-readiness-status"),
    (text) => text.includes("当前实例已按生产模式运行"),
    "Owner deployment readiness did not pass in the browser"
  );
  const deploymentText = (await deploymentCard.textContent()) ?? "";
  assertSmoke(
    deploymentText.includes(releaseId) &&
      deploymentText.includes("Web 发布") &&
      deploymentText.includes("Web 与 API 发布") &&
      deploymentText.includes("一致"),
    "Owner deployment card did not show matched Web/API release evidence"
  );
  await waitForLocatorText(
    launchCard.getByTestId("admin-cloud-pet-launch-readiness-status"),
    (text) => text.includes("内置上线检查：已通过"),
    "Owner effective launch readiness did not pass in the browser"
  );
  assertSmoke(
    await launchCard.getByTestId("admin-cloud-pet-launch-readiness-attention").count() === 0,
    "Owner launch readiness still exposed attention items"
  );
}

async function runBrowserSmoke(webBaseUrl, apiBaseUrl, webhook, member, adminCredentials) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${webBaseUrl}/cloud-pets`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-sync").waitFor({ state: "visible" });
    await page.getByTestId("cloud-member-name").fill(member.name);
    await page.getByTestId("cloud-member-phone").fill(member.phone);
    await page.getByTestId("cloud-member-request-code").click();
    const code = await waitForVerificationCode(webhook, member.phone);
    await page.getByTestId("cloud-member-code").fill(code);
    await page.getByTestId("cloud-member-sync").click();
    await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });

    const petName = `Web Pet ${member.phone.slice(-8)}`;
    await page.getByTestId("cloud-create-pet-name").fill(petName);
    await page.getByTestId("cloud-create-species").selectOption("dog");
    await page.getByTestId("cloud-create-personality").fill("Production browser persistence verification.");
    await page.getByTestId("cloud-create-submit").click();
    await page.getByText(petName, { exact: true }).first().waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });

    const sessionToken = await page.evaluate(() => localStorage.getItem("kzt_member_session"));
    const activePetNo = await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"));
    assertSmoke(sessionToken?.startsWith("member_"), "Browser login did not persist a member session");
    assertSmoke(activePetNo, "Browser create flow did not persist an active pet");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
    await page.getByText(petName, { exact: true }).first().waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });

    const careScore = page.getByTestId("cloud-care-score");
    const careState = page.getByTestId("cloud-care-state");
    const dailyCareButton = page.getByTestId("cloud-task-complete-daily-care");
    await dailyCareButton.scrollIntoViewIfNeeded();
    await dailyCareButton.waitFor({ state: "visible" });
    assertSmoke(await dailyCareButton.isEnabled(), "Daily care task was not actionable after reload");

    const beforeCareScore = Number(await careScore.textContent());
    const beforeCareState = (await careState.textContent())?.trim() ?? "";
    assertSmoke(Number.isFinite(beforeCareScore), "Browser did not render the initial care score");
    assertSmoke(beforeCareState.length > 0, "Browser did not render the initial care state");

    await dailyCareButton.click();
    await waitForLocatorText(
      page.getByTestId("cloud-today-completed-count"),
      (text) => text === "1",
      "Daily care completion did not update the visible completed count"
    );
    await page.getByTestId("cloud-today-diary-present").waitFor({ state: "visible" });
    assertSmoke(
      (await page.getByTestId("cloud-today-diary-source").textContent())?.trim() === "照顾记录",
      "Daily care diary did not render the structured care source"
    );
    await page.getByTestId("cloud-latest-diary").waitFor({ state: "visible" });

    const afterCareScore = Number(await careScore.textContent());
    const afterCareState = (await careState.textContent())?.trim() ?? "";
    assertSmoke(afterCareScore > beforeCareScore, "Care score did not increase after daily care");
    assertSmoke(afterCareState.length > 0, "Care state disappeared after daily care");
    assertSmoke(await dailyCareButton.isDisabled(), "Completed daily care remained actionable");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
    await page.getByText(petName, { exact: true }).first().waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });
    await waitForLocatorText(
      page.getByTestId("cloud-today-completed-count"),
      (text) => text === "1",
      "Daily care completion did not survive browser reload"
    );
    await waitForLocatorText(
      careScore,
      (text) => Number(text) === afterCareScore,
      "Care score did not survive browser reload"
    );
    await waitForLocatorText(
      careState,
      (text) => text === afterCareState,
      "Care state did not survive browser reload"
    );
    await page.getByTestId("cloud-today-diary-present").waitFor({ state: "visible" });
    await page.getByTestId("cloud-latest-diary").waitFor({ state: "visible" });
    assertSmoke(
      await page.getByTestId("cloud-task-complete-daily-care").isDisabled(),
      "Reloaded daily care task became actionable again"
    );

    const ownerNoteBody = `Production smoke owner note ${Date.now().toString().slice(-6)}`;
    await page.getByTestId("cloud-diary-note-body").fill(ownerNoteBody);
    await page.getByTestId("cloud-diary-note-submit").click();
    const ownerNoteEntry = page
      .getByTestId("cloud-diary-entry")
      .filter({ hasText: ownerNoteBody });
    await ownerNoteEntry.waitFor({ state: "visible" });
    await ownerNoteEntry
      .getByTestId("cloud-diary-entry-open-owner_note")
      .waitFor({ state: "visible" });
    await page.getByTestId("cloud-today-diary-present").waitFor({ state: "visible" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
    await page.getByText(petName, { exact: true }).first().waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });
    const ownerNoteEntryAfterReload = page
      .getByTestId("cloud-diary-entry")
      .filter({ hasText: ownerNoteBody });
    await ownerNoteEntryAfterReload.waitFor({ state: "visible" });
    await ownerNoteEntryAfterReload
      .getByTestId("cloud-diary-entry-open-owner_note")
      .waitFor({ state: "visible" });
    await page.getByTestId("cloud-today-diary-present").waitFor({ state: "visible" });

    const communityBody = `Production moderation smoke ${Date.now().toString().slice(-6)}`;
    await page.getByTestId("cloud-community-body").fill(communityBody);
    await page.getByTestId("cloud-community-submit").click();
    const createdCommunityPost = page
      .getByTestId("cloud-community-post")
      .filter({ hasText: communityBody });
    await createdCommunityPost.waitFor({ state: "visible" });
    const communityPostElementId = await createdCommunityPost.getAttribute("id");
    assertSmoke(
      communityPostElementId?.startsWith("community-post-"),
      "Member community post did not expose a stable post identifier"
    );
    const communityPostNo = communityPostElementId.slice("community-post-".length);
    const reportReason = createdCommunityPost.getByTestId("cloud-report-reason");
    await reportReason.selectOption({ index: 1 });
    const reportResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith(
          `/api/community/posts/${communityPostNo}/reports`
        )
    );
    await createdCommunityPost.getByTestId("cloud-report-submit").click();
    const postReportResult = await reportResponse;
    assertSmoke(postReportResult.ok(), "Member community post report failed");
    const postReportBody = await postReportResult.json();
    const communityReportNo = postReportBody.reportNo;
    assertSmoke(
      typeof communityReportNo === "string" && communityReportNo.length > 0,
      "Member community post report did not expose a stable report identifier"
    );
    await waitForLocatorText(
      page.getByTestId("cloud-community-report-count"),
      (text) => text === "1",
      "Member community report did not become visible"
    );

    const communityDetailUrl = `${webBaseUrl}/community/posts/${encodeURIComponent(communityPostNo)}`;
    await page.goto(communityDetailUrl, { waitUntil: "domcontentloaded" });
    await page.getByTestId("community-post-detail").waitFor({ state: "visible" });
    const communityCommentBody = `Production comment moderation smoke ${Date.now().toString().slice(-6)}`;
    await page.getByTestId("community-post-detail-comment-body").fill(communityCommentBody);
    await page.getByTestId("community-post-detail-comment-submit").click();
    const createdCommunityComment = page
      .getByTestId("community-post-detail-comment")
      .filter({ hasText: communityCommentBody });
    await createdCommunityComment.waitFor({ state: "visible" });
    const communityCommentNo = await createdCommunityComment.getAttribute("data-comment-no");
    assertSmoke(communityCommentNo, "Member community comment did not expose a stable comment identifier");
    const commentReportResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith(
          `/api/community/comments/${communityCommentNo}/reports`
        )
    );
    await createdCommunityComment
      .getByTestId("community-post-detail-comment-report-reason")
      .selectOption({ index: 1 });
    await createdCommunityComment
      .getByTestId("community-post-detail-comment-report-submit")
      .click();
    const commentReportResult = await commentReportResponse;
    assertSmoke(commentReportResult.ok(), "Member community comment report failed");
    const commentReportBody = await commentReportResult.json();
    const communityCommentReportNo = commentReportBody.reportNo;
    assertSmoke(
      typeof communityCommentReportNo === "string" && communityCommentReportNo.length > 0,
      "Member community comment report did not expose a stable report identifier"
    );
    await page.getByTestId("community-post-detail-status").waitFor({ state: "visible" });
    await page.goto(`${webBaseUrl}/cloud-pets`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });

    const anonymousContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const anonymousPage = await anonymousContext.newPage();
    try {
      const publicUrl = `${webBaseUrl}/cloud-pets/${encodeURIComponent(activePetNo)}`;
      await anonymousPage.goto(publicUrl, { waitUntil: "domcontentloaded" });
      const publicProfile = anonymousPage.getByTestId("pet-public-profile");
      await publicProfile.waitFor({ state: "visible" });
      await publicProfile.getByRole("img", { name: petName }).waitFor({ state: "visible" });
      await waitForLocatorText(
        anonymousPage.getByTestId("pet-public-pet-no"),
        (text) => text === activePetNo,
        "Anonymous public homepage did not render the created pet"
      );
      await anonymousPage.getByTestId("pet-public-care-signal").waitFor({ state: "visible" });
      await anonymousPage.getByTestId("pet-public-share-card").waitFor({ state: "visible" });

      const publicPayload = await anonymousPage.evaluate(async (url) => {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        const body = await response.json();
        return { status: response.status, keys: Object.keys(body) };
      }, `${apiBaseUrl}/api/cloud-pets/${encodeURIComponent(activePetNo)}`);
      assertSmoke(publicPayload.status === 200, "Anonymous public profile API did not return 200");
      for (const key of ["petNo", "name", "growth", "homepage"]) {
        assertSmoke(publicPayload.keys.includes(key), `Public profile omitted expected field: ${key}`);
      }
      for (const key of ["ownerName", "ownerPhone"]) {
        assertSmoke(!publicPayload.keys.includes(key), `Public profile exposed private field: ${key}`);
      }
    } finally {
      await anonymousContext.close();
    }

    const backfillPetName = `Web Gap Pet ${member.phone.slice(-8)}`;
    await page.getByTestId("cloud-create-pet-name").fill(backfillPetName);
    await page.getByTestId("cloud-create-species").selectOption("cat");
    await page
      .getByTestId("cloud-create-personality")
      .fill("Production browser diary gap recovery verification.");
    await page.getByTestId("cloud-create-submit").click();
    await page.getByText(backfillPetName, { exact: true }).first().waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });

    const backfillPetNo = await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"));
    assertSmoke(backfillPetNo && backfillPetNo !== activePetNo, "Browser did not persist the second pet as active");
    const backfillPetScoreBefore = Number(await page.getByTestId("cloud-care-score").textContent());
    const backfillPetCompletedCountBefore = (await page.getByTestId("cloud-today-completed-count").textContent())?.trim();
    assertSmoke(Number.isFinite(backfillPetScoreBefore), "Second pet care score was not rendered");
    assertSmoke(backfillPetCompletedCountBefore === "0", "Second pet unexpectedly had a completed task");
    await page.getByTestId("cloud-today-diary-missing").waitFor({ state: "visible" });
    const backfillPetCareButton = page.getByTestId("cloud-task-complete-daily-care");
    assertSmoke(await backfillPetCareButton.isEnabled(), "Second pet care task was not actionable before backfill");

    let backfillDate = "";
    const adminContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto(`${webBaseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded" });
      await adminPage.locator('input[type="email"]').fill(adminCredentials.email);
      await adminPage.locator('input[type="password"]').fill(adminCredentials.password);
      await adminPage.locator("form.admin-token-form button[type=submit]").click();
      await adminPage.getByTestId("admin-member-verification-metrics").waitFor({ state: "visible" });

      const recoveryResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/api/admin/ops/sqlite-recovery/run")
      );
      await adminPage.getByTestId("admin-sqlite-recovery-run").click();
      assertSmoke((await recoveryResponse).ok(), "Production browser recovery verification failed");
      await waitForLocatorText(
        adminPage.getByTestId("admin-sqlite-recovery-status-value"),
        (text) => text.includes("已通过恢复演练"),
        "Production browser recovery status did not become recoverable"
      );
      await waitForLocatorText(
        adminPage.getByTestId("admin-sqlite-recovery-freshness"),
        (text) => text.includes("正常"),
        "Production browser recovery backup was not fresh"
      );
      await adminPage
        .getByTestId("admin-cloud-pet-launch-readiness-refresh")
        .click();
      await verifyOwnerLaunchReadiness(adminPage);

      const cloudPetSection = adminPage.locator("#admin-cloud-pets");
      await cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics").waitFor({ state: "visible" });

      async function filterAndRestoreRiskPet() {
        const riskReasonFilter = cloudPetSection.getByTestId(
          "admin-cloud-pet-filter-risk-reason"
        );
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(backfillPetNo);
        await riskReasonFilter.selectOption("care_incomplete_today");

        const filteredResponse = adminPage.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET" &&
            url.pathname.endsWith("/api/admin/cloud-pets") &&
            url.searchParams.get("q") === backfillPetNo
          );
        });
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
        assertSmoke((await filteredResponse).ok(), "Admin risk-reason filter request failed");
        assertSmoke(
          new URL(adminPage.url()).searchParams.get("riskReason") === "care_incomplete_today",
          "Admin risk-reason filter was not written to the URL"
        );

        const listItem = cloudPetSection.locator(
          `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${backfillPetNo}"]`
        );
        await listItem.waitFor({ state: "visible" });
        assertSmoke(
          await cloudPetSection.getByTestId("admin-cloud-pet-list-item").count() === 1,
          "Admin risk-reason filter did not isolate the backfill pet"
        );
        const detailResponse = adminPage.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname.endsWith(
              `/api/admin/cloud-pets/${encodeURIComponent(backfillPetNo)}/detail`
            )
        );
        await listItem.getByTestId("admin-cloud-pet-detail-open").click();
        assertSmoke((await detailResponse).ok(), "Admin risk-reason detail request failed");

        const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
        await detail.waitFor({ state: "visible" });
        await waitForLocatorText(
          detail,
          (text) => text.includes(backfillPetNo),
          "Admin risk-reason detail did not render the target pet"
        );
        const riskDetailText = (await detail.textContent()) ?? "";
        assertSmoke(
          riskDetailText.includes(backfillPetNo),
          `Admin risk-reason detail opened the wrong pet; expected ${backfillPetNo}, got ${riskDetailText.slice(0, 300)}`
        );
        assertSmoke(
          new URL(adminPage.url()).searchParams.get("petNo") === backfillPetNo,
          "Admin risk-reason detail did not write petNo to the URL"
        );

        await adminPage.reload({ waitUntil: "domcontentloaded" });
        await adminPage.getByTestId("admin-member-verification-metrics").waitFor({ state: "visible" });
        await cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics").waitFor({ state: "visible" });
        await riskReasonFilter.waitFor({ state: "visible" });
        assertSmoke(
          (await riskReasonFilter.inputValue()) === "care_incomplete_today",
          "Admin risk-reason filter did not survive production reload"
        );
        await cloudPetSection.getByTestId("admin-cloud-pet-detail").waitFor({ state: "visible" });
        await waitForLocatorText(
          cloudPetSection.getByTestId("admin-cloud-pet-detail"),
          (text) => text.includes(backfillPetNo),
          "Admin risk-reason detail did not render after production reload"
        );
        assertSmoke(
          ((await cloudPetSection.getByTestId("admin-cloud-pet-detail").textContent()) ?? "").includes(backfillPetNo),
          "Admin risk-reason detail did not survive production reload"
        );
        assertSmoke(
          new URL(adminPage.url()).searchParams.get("petNo") === backfillPetNo,
          "Admin risk-reason petNo did not survive production reload"
        );
      }

      async function filterAndOpenAdminPet() {
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-risk-reason").selectOption("");
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(activePetNo);
        const filteredResponse = adminPage.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET" &&
            url.pathname.endsWith("/api/admin/cloud-pets") &&
            url.searchParams.get("q") === activePetNo
          );
        });
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
        assertSmoke((await filteredResponse).ok(), "Admin cloud-pet filter request failed");

        const listItem = cloudPetSection.locator(
          `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${activePetNo}"]`
        );
        await listItem.waitFor({ state: "visible" });
        assertSmoke(
          await cloudPetSection.getByTestId("admin-cloud-pet-list-item").count() === 1,
          "Admin petNo filter did not isolate the member-created pet"
        );
        const detailResponse = adminPage.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname.endsWith(
              `/api/admin/cloud-pets/${encodeURIComponent(activePetNo)}/detail`
            )
        );
        await listItem.getByTestId("admin-cloud-pet-detail-open").click();
        assertSmoke((await detailResponse).ok(), "Admin detail request failed");

        const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
        await detail.waitFor({ state: "visible" });
        await waitForLocatorText(
          detail,
          (text) => text.includes(activePetNo),
          "Admin detail did not render the member-created pet"
        );
        const detailText = (await detail.textContent()) ?? "";
        assertSmoke(detailText.includes(activePetNo), "Admin detail opened the wrong pet");
        assertSmoke(
          detailText.includes(String(afterCareScore)),
          "Admin detail did not show the member care score"
        );
        await detail
          .getByTestId("admin-cloud-pet-recent-diaries")
          .getByText(ownerNoteBody, { exact: true })
          .waitFor({ state: "visible" });
      }

      async function refreshAfterAnonymousPetVisit() {
        const riskReasonFilter = cloudPetSection.getByTestId(
          "admin-cloud-pet-filter-risk-reason"
        );
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-q").fill(backfillPetNo);
        await riskReasonFilter.selectOption("no_homepage_visits");

        const filteredResponse = adminPage.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET" &&
            url.pathname.endsWith("/api/admin/cloud-pets") &&
            url.searchParams.get("q") === backfillPetNo
          );
        });
        await cloudPetSection.getByTestId("admin-cloud-pet-filter-apply").click();
        assertSmoke((await filteredResponse).ok(), "Admin no-visit filter request failed");
        assertSmoke(
          new URL(adminPage.url()).searchParams.get("riskReason") === "no_homepage_visits",
          "Admin no-visit filter was not written to the URL"
        );

        const listItem = cloudPetSection.locator(
          `[data-testid="admin-cloud-pet-list-item"][data-pet-no="${backfillPetNo}"]`
        );
        await listItem.waitFor({ state: "visible" });
        const detailResponse = adminPage.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname.endsWith(
              `/api/admin/cloud-pets/${encodeURIComponent(backfillPetNo)}/detail`
            )
        );
        await listItem.getByTestId("admin-cloud-pet-detail-open").click();
        assertSmoke((await detailResponse).ok(), "Admin no-visit detail request failed");

        const detail = cloudPetSection.getByTestId("admin-cloud-pet-detail");
        await detail.waitFor({ state: "visible" });
        await waitForLocatorText(
          detail,
          (text) => text.includes(backfillPetNo),
          "Admin no-visit detail did not render the target pet"
        );
        assertSmoke(
          ((await detail.getByTestId("admin-cloud-pet-risk-signals").textContent()) ?? "").includes(
            "公开主页尚无访问记录"
          ),
          "Admin no-visit detail did not show the expected risk"
        );

        const visitorContext = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true
        });
        const visitorPage = await visitorContext.newPage();
        try {
          const visitResponse = visitorPage.waitForResponse(
            (response) =>
              response.request().method() === "POST" &&
              new URL(response.url()).pathname.endsWith(
                `/api/cloud-pets/${encodeURIComponent(backfillPetNo)}/homepage/visits`
              )
          );
          await visitorPage.goto(`${webBaseUrl}/cloud-pets/${backfillPetNo}`, {
            waitUntil: "domcontentloaded"
          });
          await visitorPage.getByTestId("pet-public-profile").waitFor({ state: "visible" });
          assertSmoke((await visitResponse).ok(), "Anonymous Pet B homepage visit failed");
          await visitorPage.getByTestId("pet-public-pet-no").waitFor({ state: "visible" });
        } finally {
          await visitorContext.close();
        }

        const refreshedListResponse = adminPage.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET" &&
            url.pathname.endsWith("/api/admin/cloud-pets") &&
            url.searchParams.get("q") === backfillPetNo
          );
        });
        const refreshedDetailResponse = adminPage.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            new URL(response.url()).pathname.endsWith(
              `/api/admin/cloud-pets/${encodeURIComponent(backfillPetNo)}/detail`
            )
        );
        await cloudPetSection.getByTestId("admin-cloud-pet-refresh").click();
        assertSmoke((await refreshedListResponse).ok(), "Admin manual refresh list request failed");
        assertSmoke((await refreshedDetailResponse).ok(), "Admin manual refresh detail request failed");
        await waitForLocatorCount(
          cloudPetSection.getByTestId("admin-cloud-pet-list-item"),
          (count) => count === 0,
          "Admin no-visit filter did not remove the visited pet after refresh"
        );
        await waitForLocatorText(
          detail.getByTestId("admin-cloud-pet-risk-signals"),
          (text) => !text.includes("公开主页尚无访问记录"),
          "Admin detail did not absorb the visited state after manual refresh"
        );
        assertSmoke(
          ((await detail.getByTestId("admin-cloud-pet-risk-signals").textContent()) ?? "").includes(
            "公开主页尚无访问记录"
          ) === false,
          "Admin detail retained the stale no-visit risk after manual refresh"
        );
        assertSmoke(
          new URL(adminPage.url()).searchParams.get("riskReason") === "no_homepage_visits" &&
            new URL(adminPage.url()).searchParams.get("petNo") === backfillPetNo,
          "Admin manual refresh did not preserve the no-visit detail URL"
        );
      }

      await filterAndRestoreRiskPet();
      await refreshAfterAnonymousPetVisit();
      await filterAndOpenAdminPet();
      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await adminPage.getByTestId("admin-member-verification-metrics").waitFor({ state: "visible" });
      await verifyOwnerLaunchReadiness(adminPage);
      await cloudPetSection.getByTestId("admin-cloud-pet-retention-metrics").waitFor({ state: "visible" });
      await filterAndOpenAdminPet();

      const reportSection = adminPage.locator("#admin-community-reports");
      await reportSection
        .getByTestId("admin-community-report-filter-comment")
        .fill(communityCommentNo);
      const commentReportFilterResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname.endsWith("/api/admin/community/reports") &&
          new URL(response.url()).searchParams.get("commentNo") === communityCommentNo
      );
      await reportSection
        .getByTestId("admin-community-report-filter-form")
        .locator('button[type="submit"]')
        .click();
      assertSmoke((await commentReportFilterResponse).ok(), "Admin comment report filter failed");
      const commentReportItem = reportSection.locator(
        `[data-testid="admin-community-report-item"][data-report-no="${communityCommentReportNo}"]`
      );
      await commentReportItem.waitFor({ state: "visible" });
      const commentUpdate = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.endsWith(
            `/api/admin/community/comments/${communityCommentNo}/status`
          )
      );
      const commentReportUpdate = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.endsWith(
            `/api/admin/community/reports/${communityCommentReportNo}/status`
          )
      );
      await commentReportItem
        .getByTestId("admin-community-report-resolve-hide-comment")
        .click();
      assertSmoke((await commentUpdate).ok(), "Admin community comment hide failed");
      assertSmoke((await commentReportUpdate).ok(), "Admin community comment report resolution failed");
      await commentReportItem
        .getByTestId("admin-community-report-resolve-hide-comment")
        .waitFor({ state: "hidden" });

      await page.goto(`${communityDetailUrl}#comment-${encodeURIComponent(communityCommentNo)}`, {
        waitUntil: "domcontentloaded"
      });
      await page.getByTestId("community-post-detail").waitFor({ state: "visible" });
      await page.getByText(communityBody, { exact: true }).waitFor({ state: "visible" });
      await waitForLocatorCount(
        page.getByTestId("community-post-detail-comment"),
        (count) => count === 0,
        "Hidden community comment remained visible in the production post detail"
      );
      await page.getByTestId("community-post-detail-comments-empty").waitFor({ state: "visible" });
      assertSmoke(
        (await page.getByTestId("community-post-detail-error").count()) === 0,
        "Hidden community comment deep-link rendered a production detail error"
      );

      await page.goto(`${webBaseUrl}/cloud-pets`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
      await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });
      await reportSection
        .getByTestId("admin-community-report-filter-comment")
        .fill("");
      await reportSection
        .getByTestId("admin-community-report-filter-post")
        .fill(communityPostNo);
      const reportFilterResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname.endsWith("/api/admin/community/reports") &&
          new URL(response.url()).searchParams.get("postNo") === communityPostNo
      );
      await reportSection
        .getByTestId("admin-community-report-filter-form")
        .getByRole("button", { name: "应用筛选" })
        .click();
      assertSmoke((await reportFilterResponse).ok(), "Admin community report filter failed");

      const reportItem = reportSection.locator(
        `[data-testid="admin-community-report-item"][data-report-no="${communityReportNo}"]`
      );
      await reportItem.waitFor({ state: "visible" });
      const postUpdate = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.endsWith(
            `/api/admin/community/posts/${communityPostNo}/status`
          )
      );
      const reportUpdate = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.includes("/api/admin/community/reports/") &&
          new URL(response.url()).pathname.endsWith("/status")
      );
      await reportItem.getByTestId("admin-community-report-resolve-hide").click();
      assertSmoke((await postUpdate).ok(), "Admin community post hide failed");
      assertSmoke((await reportUpdate).ok(), "Admin community report resolution failed");
      await waitForLocatorText(
        reportItem.getByTestId("admin-community-report-status"),
        (text) => text.includes("已处理"),
        "Admin community report did not become resolved"
      );
      await reportItem
        .getByTestId("admin-community-report-resolve-hide")
        .waitFor({ state: "hidden" });
      const moderatedPost = adminPage
        .locator("#admin-community-posts .admin-post")
        .filter({ hasText: communityPostNo });
      await moderatedPost.waitFor({ state: "visible" });
      assertSmoke(
        (await moderatedPost.textContent())?.includes("hidden"),
        "Admin community post did not show hidden status"
      );

      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await adminPage.getByTestId("admin-member-verification-metrics").waitFor({ state: "visible" });
      const auditSection = adminPage
        .locator("article.admin-card")
        .filter({ hasText: "近期操作日志" });
      await auditSection
        .getByText("community.post_status.update", { exact: true })
        .waitFor({ state: "visible" });
      await waitForLocatorCount(
        auditSection.locator(
          `[data-testid="admin-operation-log-item"][data-action="community.report_status.update"]`
        ),
        (count) => count >= 2,
        "Admin operation log did not retain both community report operations"
      );
      const postAuditItem = auditSection.locator(
        `[data-testid="admin-operation-log-item"][data-action="community.post_status.update"][data-target-id="${communityPostNo}"]`
      );
      const reportAuditItem = auditSection.locator(
        `[data-testid="admin-operation-log-item"][data-action="community.report_status.update"][data-target-id="${communityReportNo}"]`
      );
      await postAuditItem.waitFor({ state: "visible" });
      await reportAuditItem.waitFor({ state: "visible" });
      for (const [auditItem, targetType] of [
        [postAuditItem, "community_post"],
        [reportAuditItem, "community_report"]
      ]) {
        assertSmoke(
          (await auditItem.getAttribute("data-staff-name")) === adminCredentials.name,
          "Admin operation log displayed an unexpected staff name"
        );
        assertSmoke(
          (await auditItem.getAttribute("data-staff-role")) === "owner" &&
            (await auditItem.getAttribute("data-target-type")) === targetType,
          "Admin operation log displayed incomplete staff or target metadata"
        );
      }

      await adminPage.goto(`${webBaseUrl}/admin/pets/daily-diary-coverage`, {
        waitUntil: "domcontentloaded"
      });
      backfillDate = await adminPage.getByTestId("admin-diary-coverage-date").inputValue();
      const missingBackfillPet = adminPage.locator(
        `[data-testid="admin-diary-missing-pet"][data-pet-no="${backfillPetNo}"]`
      );
      await missingBackfillPet.waitFor({ state: "visible" });
      await missingBackfillPet.locator('input[type="checkbox"]').check();
      await waitForLocatorText(
        adminPage.getByTestId("admin-diary-selected-count"),
        (text) => text.includes("1"),
        "Admin diary coverage did not select the second pet"
      );

      const backfillResponse = adminPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith(
            "/api/admin/pets/daily-diary-coverage/backfill"
          )
      );
      await adminPage.getByTestId("admin-diary-backfill-selected").click();
      assertSmoke((await backfillResponse).status() === 201, "Admin selected diary backfill failed");
      const backfillResult = adminPage.getByTestId("admin-diary-backfill-result");
      await backfillResult.waitFor({ state: "visible" });
      const backfillResultText = (await backfillResult.textContent()) ?? "";
      assertSmoke(backfillResultText.includes(backfillPetName), "Admin backfill result omitted the target pet");
      await missingBackfillPet.waitFor({ state: "detached" });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("cloud-member-profile").waitFor({ state: "visible" });
      await page.getByText(backfillPetName, { exact: true }).first().waitFor({ state: "visible" });
      await page.getByTestId("cloud-daily-panel").waitFor({ state: "visible" });
      await page.getByTestId("cloud-today-diary-present").waitFor({ state: "visible" });
      assertSmoke(
        (await page.getByTestId("cloud-today-diary-source").textContent())?.trim() === "当日补记" &&
          (await page.getByTestId("cloud-today-diary-source-note").textContent())?.includes("没有完成新的照顾任务"),
        "Backfilled diary did not render the non-completion source semantics"
      );
      assertSmoke(
        ((await page.getByTestId("cloud-today-diary-present").textContent()) ?? "").includes(backfillPetName),
        "Member reload did not show the backfilled diary for the second pet"
      );
      await waitForLocatorText(
        page.getByTestId("cloud-today-completed-count"),
        (text) => text === backfillPetCompletedCountBefore,
        "Diary backfill changed the member task completion count"
      );
      const backfillPetScoreAfter = Number(await page.getByTestId("cloud-care-score").textContent());
      assertSmoke(
        backfillPetScoreAfter === backfillPetScoreBefore,
        "Diary backfill changed the member care score"
      );
      assertSmoke(
      await page.getByTestId("cloud-task-complete-daily-care").isEnabled(),
        "Diary backfill made the member care task unavailable"
      );
      await waitForLocatorCount(
        page.getByTestId("cloud-community-post").filter({ hasText: communityBody }),
        (count) => count === 0,
        "Hidden community post remained visible in the member feed after reload"
      );
    } finally {
      await adminContext.close();
    }

    const logoutResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/api/auth/logout")
    );
    await page.getByTestId("cloud-member-logout").click();
    assertSmoke((await logoutResponse).ok(), "Member logout API did not return a success response");
    await page.getByTestId("cloud-member-profile").waitFor({ state: "detached" });
    await page.getByTestId("cloud-member-sync").waitFor({ state: "visible" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "detached" });
    assertSmoke(
      (await page.evaluate(() => localStorage.getItem("kzt_member_session"))) === null,
      "Browser logout did not clear the member session"
    );
    assertSmoke(
      (await page.evaluate(() => localStorage.getItem("kzt_active_cloud_pet"))) === null,
      "Browser logout did not clear the active cloud pet"
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("cloud-member-sync").waitFor({ state: "visible" });
    await page.getByTestId("cloud-member-profile").waitFor({ state: "detached" });
    await page.getByTestId("cloud-daily-panel").waitFor({ state: "detached" });
    const loggedOutPrivateProfile = await page.evaluate(async ({ token, apiBaseUrl }) => {
      const response = await fetch(`${apiBaseUrl}/api/members/me`, {
        headers: { "X-Member-Token": token }
      });
      return response.status;
    }, { token: sessionToken, apiBaseUrl });
    assertSmoke(
      loggedOutPrivateProfile === 401,
      "Logged-out browser context could still access the private member profile API"
    );
    return {
      petNo: activePetNo,
      ownerNoteBody,
      backfillPetNo,
      backfillPetName,
      backfillDate,
      backfillPetScoreBefore,
      backfillPetCompletedCountBefore,
      communityPostNo,
      communityCommentNo,
      communityCommentReportNo,
      communityReportNo,
      communityBody,
      auditStaffName: adminCredentials.name
    };
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : "Browser smoke failed"}\n` +
        `Browser URL: ${page.url()}`
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyPrisma(database, member, result) {
  const prisma = new PrismaClient({ datasourceUrl: database });
  try {
    const start = new Date(`${result.backfillDate}T00:00:00.000Z`);
    const end = new Date(`${result.backfillDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const [session, pet, ownerNoteCount, dailyDiaryCount, backfillPet, backfillDiaryCount, backfillTaskCount, communityPost, communityComment, communityReport, communityCommentReport, communityOperationLogs] = await Promise.all([
      prisma.memberSession.findFirst({ where: { phone: member.phone }, select: { revokedAt: true } }),
      prisma.virtualPet.findUnique({ where: { petNo: result.petNo }, select: { ownerPhone: true } }),
      prisma.virtualPetEvent.count({ where: { pet: { petNo: result.petNo }, type: "owner_note", body: result.ownerNoteBody } }),
      prisma.virtualPetEvent.count({
        where: { pet: { petNo: result.petNo }, type: { in: diaryEventTypes } }
      }),
      prisma.virtualPet.findUnique({ where: { petNo: result.backfillPetNo }, select: { ownerPhone: true } }),
      prisma.virtualPetEvent.count({
        where: {
          pet: { petNo: result.backfillPetNo },
          type: { in: diaryEventTypes },
          createdAt: { gte: start, lt: end }
        }
      }),
      prisma.virtualPetTaskCompletion.count({ where: { pet: { petNo: result.backfillPetNo }, completedDate: result.backfillDate } }),
      prisma.communityPost.findUnique({ where: { postNo: result.communityPostNo }, select: { status: true } }),
      prisma.communityComment.findUnique({
        where: { commentNo: result.communityCommentNo },
        select: { status: true, authorDeletedAt: true, postNo: true }
      }),
      prisma.communityReport.findUnique({ where: { reportNo: result.communityReportNo }, select: { status: true, resolvedAt: true } }),
      prisma.communityReport.findUnique({
        where: { reportNo: result.communityCommentReportNo },
        select: { status: true, resolvedAt: true, commentNo: true, postNo: true }
      }),
      prisma.operationLog.findMany({
        where: {
          action: {
            in: [
              "community.comment_status.update",
              "community.post_status.update",
              "community.report_status.update"
            ]
          },
          targetId: {
            in: [
              result.communityPostNo,
              result.communityCommentNo,
              result.communityReportNo,
              result.communityCommentReportNo
            ]
          }
        },
        select: { staffNo: true, staffName: true, role: true, action: true, targetType: true, targetId: true }
      })
    ]);
    assertSmoke(session?.revokedAt, "Prisma final check could not find the revoked member session");
    assertSmoke(pet?.ownerPhone === member.phone, "Prisma final check found an incorrectly owned pet");
    assertSmoke(ownerNoteCount === 1, "Prisma final check could not find exactly one owner note");
    assertSmoke(dailyDiaryCount >= 1, "Prisma final check could not find the automatic diary");
    assertSmoke(backfillPet?.ownerPhone === member.phone, "Prisma final check found an incorrectly owned backfill pet");
    assertSmoke(backfillDiaryCount === 1, "Prisma final check could not find exactly one backfilled diary");
    assertSmoke(backfillTaskCount === 0, "Prisma final check found a task completion created by diary backfill");
    assertSmoke(
      communityComment?.status === "hidden" &&
        communityComment.authorDeletedAt === null &&
        communityComment.postNo === result.communityPostNo,
      "Prisma final check found an incorrectly moderated community comment"
    );
    assertSmoke(communityPost?.status === "hidden", "Prisma final check found the moderated community post still visible");
    assertSmoke(communityReport?.status === "reviewed" && communityReport.resolvedAt, "Prisma final check found the community report unresolved");
    assertSmoke(
      communityCommentReport?.status === "reviewed" &&
        communityCommentReport.resolvedAt &&
        communityCommentReport.commentNo === result.communityCommentNo &&
        communityCommentReport.postNo === result.communityPostNo,
      "Prisma final check found the community comment report unresolved"
    );
    const commentOperation = communityOperationLogs.find(
      (log) =>
        log.action === "community.comment_status.update" &&
        log.targetId === result.communityCommentNo
    );
    const postOperation = communityOperationLogs.find(
      (log) => log.action === "community.post_status.update" && log.targetId === result.communityPostNo
    );
    const reportOperation = communityOperationLogs.find(
      (log) => log.action === "community.report_status.update" && log.targetId === result.communityReportNo
    );
    const commentReportOperation = communityOperationLogs.find(
      (log) =>
        log.action === "community.report_status.update" &&
        log.targetId === result.communityCommentReportNo
    );
    for (const [operation, targetType] of [
      [commentOperation, "community_comment"],
      [postOperation, "community_post"],
      [reportOperation, "community_report"],
      [commentReportOperation, "community_report"]
    ]) {
      assertSmoke(operation, "Prisma final check could not find a community moderation operation log");
      assertSmoke(operation.staffName === result.auditStaffName, "Prisma final check found an unexpected operation staff");
      assertSmoke(operation.role === "owner" && operation.targetType === targetType, "Prisma final check found incomplete operation staff or target data");
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-pet-web-production-smoke-"));
  const databasePath = join(temporaryDirectory, "source.db");
  const apiPort = await getAvailablePort();
  const webPort = await getAvailablePort();
  const webhookPort = await getAvailablePort();
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  // nip.io resolves this public-looking origin to loopback, keeping the
  const webListenBaseUrl = `http://127.0.0.1:${webPort}`;
  const webBaseUrl = webListenBaseUrl;
  const database = databaseUrl(databasePath);
  const recoveryDirectory = join(temporaryDirectory, "recovery");
  const webhook = await startVerificationWebhook(webhookPort);
  const runId = String(Date.now()).slice(-8);
  const member = { name: `Web Smoke Member ${runId}`, phone: `138${runId}` };
  const adminCredentials = {
    name: "Cloud Pet Web Smoke Owner",
    email: "cloud-pet-web-smoke-owner@example.com",
    password: "cloud-pet-web-smoke-owner-secret-2026"
  };
  const env = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: database,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    CLOUD_PET_RELEASE_ID: releaseId,
    ADMIN_API_KEY: "cloud-pet-web-production-smoke-admin-key-2026",
    ADMIN_OWNER_NAME: adminCredentials.name,
    ADMIN_OWNER_EMAIL: adminCredentials.email,
    ADMIN_OWNER_PASSWORD: adminCredentials.password,
    WEB_ORIGIN: webBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: `${apiBaseUrl}/api`,
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-web-production-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: webhook.url,
    MEMBER_AUTH_WEBHOOK_TOKEN: webhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-web-production-ops-token-with-more-than-32-chars",
    SQLITE_RECOVERY_STATUS_DIR: recoveryDirectory,
    SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "false",
    PAYMENT_TIMEOUT_MINUTES: "30",
    PORT: String(apiPort)
  };
  const smokeEnv = {
    ...env,
    [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: computeCloudPetSafeConfigSha256(env)
  };
  let api;
  let web;
  try {
    await writeFile(databasePath, "", { flag: "wx" });
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], smokeEnv);
    await run(process.execPath, [adminOwnerBootstrapScript], smokeEnv);
    await run(process.execPath, [nextCli, "build", "web"], smokeEnv);
    api = startProcess(process.execPath, [apiEntry], smokeEnv);
    await waitForApi(apiBaseUrl, api);
    web = startProcess(process.execPath, [nextCli, "start", "web", "-p", String(webPort), "-H", "127.0.0.1"], {
      ...smokeEnv,
      PORT: String(webPort)
    });
    await waitForWeb(webListenBaseUrl, web);
    const result = await runBrowserSmoke(
      webBaseUrl,
      apiBaseUrl,
      webhook,
      member,
      adminCredentials
    );
    await verifyPrisma(database, member, result);
    console.log(JSON.stringify({ ok: true, code: "CLOUD_PET_WEB_PRODUCTION_SMOKE_PASSED" }));
  } finally {
    await stopProcess(web);
    await stopProcess(api);
    await webhook.close();
    if (process.env.KEEP_CLOUD_PET_WEB_PRODUCTION_SMOKE !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    code: "CLOUD_PET_WEB_PRODUCTION_SMOKE_FAILED",
    message: error instanceof Error ? error.message : "Unexpected smoke failure"
  }));
  process.exitCode = 1;
});
