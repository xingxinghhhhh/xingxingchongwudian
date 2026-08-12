import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
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
const bootstrapScript = resolve(rootDir, "scripts/bootstrap-admin-owner.mjs");
const schemaPath = resolve(rootDir, "prisma/schema.prisma");
const nextEnvPath = resolve(rootDir, "web/next-env.d.ts");
const releaseId = "cloud-pet-warm-restart-drill";
const webhookToken = "cloud-pet-warm-restart-drill-webhook-token";
const {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} = await import(
  pathToFileURL(resolve(rootDir, "dist/config/cloud-pet-config-fingerprint.js")).href
);

function assertDrill(condition, message) {
  if (!condition) throw new Error(message);
}

function databaseUrl(databasePath) {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}

function runCommand(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk.toString()}`.slice(-4_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
    });
    child.once("error", (error) => rejectRun(error));
    child.once("exit", (code) => resolveRun({ code, stdout, stderr }));
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
  assertDrill(port, "Warm-restart drill port allocation failed");
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
        assertDrill(payload.phone && payload.code, "Verification webhook payload was incomplete");
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
    clearCode: (phone) => codes.delete(phone),
    close: () => new Promise((resolveClose) => server.close(resolveClose))
  };
}

function startProcess(command, args, env, withIpc = false) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    windowsHide: true,
    stdio: withIpc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-4_000);
  });
  child.stderr.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-4_000);
  });
  return { child, getOutput: () => output };
}

async function stopProcessGracefully(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) return;
  assertDrill(
    typeof processHandle.child.send === "function",
    "Warm-restart drill API was not started with IPC"
  );
  processHandle.child.send("kzt:graceful-shutdown");
  const exited = once(processHandle.child, "exit");
  const timeout = new Promise((resolveTimeout) =>
    setTimeout(resolveTimeout, 10_000, "timeout")
  );
  assertDrill(
    (await Promise.race([exited, timeout])) !== "timeout",
    `Warm-restart API did not stop gracefully\n${processHandle.getOutput()}`
  );
  assertDrill(
    processHandle.child.exitCode === 0,
    `Warm-restart API exited unsuccessfully\n${processHandle.getOutput()}`
  );
}

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) return;
  processHandle.child.kill();
  const exited = once(processHandle.child, "exit");
  const timeout = new Promise((resolveTimeout) =>
    setTimeout(resolveTimeout, 5_000, "timeout")
  );
  if ((await Promise.race([exited, timeout])) === "timeout") {
    processHandle.child.kill("SIGKILL");
    await once(processHandle.child, "exit");
  }
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
      throw new Error("Warm-restart drill received invalid JSON");
    }
  }
  return { response, body };
}

async function waitForApi(baseUrl, api) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error(`Warm-restart API exited before readiness\n${api.getOutput()}`);
    }
    try {
      const result = await requestJson(baseUrl, "/api/health/ready");
      if (
        result.response.ok &&
        result.body?.status === "ready" &&
        result.body?.database?.connected === true
      ) {
        return;
      }
    } catch {
      // The API may still be binding its port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Warm-restart API readiness timed out\n${api.getOutput()}`);
}

async function waitForWeb(baseUrl, web) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (web.child.exitCode !== null) {
      throw new Error(`Warm-restart web exited before readiness\n${web.getOutput()}`);
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
  throw new Error(`Warm-restart web readiness timed out\n${web.getOutput()}`);
}

async function waitForCode(webhook, phone) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const code = webhook.getCode(phone);
    if (code) return code;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Verification webhook did not receive the warm-restart code");
}

async function waitForEnabled(locator, message) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(message);
}

async function waitForVisible(locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new Error(message);
  }
}

async function loginMember(page, webBaseUrl, webhook, member) {
  await page.goto(`${webBaseUrl}/cloud-pets`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("cloud-member-name").fill(member.name);
  await page.getByTestId("cloud-member-phone").fill(member.phone);
  webhook.clearCode(member.phone);
  await page.getByTestId("cloud-member-request-code").click();
  const code = await waitForCode(webhook, member.phone);
  await page.getByTestId("cloud-member-code").fill(code);
  const syncButton = page.getByTestId("cloud-member-sync");
  await waitForEnabled(syncButton, "Member sync button did not become enabled");
  await syncButton.click();
  await waitForVisible(page.getByTestId("cloud-member-profile"), "Member login did not complete");
}

async function loginOwner(page, webBaseUrl, owner) {
  await page.goto(`${webBaseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(owner.email);
  await page.locator('input[type="password"]').fill(owner.password);
  await page.locator("form.admin-token-form button[type=submit]").click();
  await waitForVisible(page.getByTestId("admin-member-verification-metrics"), "Owner Admin login did not complete");
}

async function readMemberProfile(apiBaseUrl, sessionToken) {
  const result = await requestJson(apiBaseUrl, "/api/members/me", {
    headers: { "X-Member-Token": sessionToken }
  });
  assertDrill(result.response.ok && result.body?.pets?.length === 1, "Member profile did not contain exactly one pet");
  return result.body;
}

async function verifyDatabase(database, ownerEmail, memberPhone, petNo, expectedDiaryCount) {
  const prisma = new PrismaClient({ datasourceUrl: database });
  try {
    const owners = await prisma.adminStaffAccount.findMany({
      where: { role: "owner", status: "active" },
      select: { email: true }
    });
    assertDrill(owners.length === 1 && owners[0].email === ownerEmail, "Warm-restart Owner continuity failed");
    const pet = await prisma.virtualPet.findUnique({
      where: { petNo },
      select: { ownerPhone: true, id: true }
    });
    assertDrill(pet?.ownerPhone === memberPhone, "Warm-restart pet ownership did not persist");
    const taskCount = await prisma.virtualPetTaskCompletion.count({ where: { petId: pet.id } });
    const diaryCount = await prisma.virtualPetEvent.count({
      where: { petId: pet.id, type: "care_daily_diary" }
    });
    assertDrill(taskCount >= 1, "Warm-restart care task completion did not persist");
    assertDrill(diaryCount === expectedDiaryCount, "Warm-restart created an unexpected additional care diary");
    return { ownerCount: owners.length, petCount: 1, careTaskCount: taskCount, careDiaryCount: diaryCount };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-pet-warm-restart-"));
  const databasePath = join(temporaryDirectory, "handover.db");
  const database = databaseUrl(databasePath);
  const lockPath = `${databasePath}.runtime.lock`;
  const recoveryDirectory = join(temporaryDirectory, "recovery");
  const apiPort = await getAvailablePort();
  const webPort = await getAvailablePort();
  const webhookPort = await getAvailablePort();
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const webBaseUrl = `http://127.0.0.1:${webPort}`;
  const runId = String(Date.now()).slice(-8);
  const owner = {
    name: "Cloud Pet Warm Restart Owner",
    email: "cloud-pet-warm-restart-owner@example.com",
    password: "cloud-pet-warm-restart-owner-secret-2026"
  };
  const member = {
    name: `Warm Restart Member ${runId}`,
    phone: `138${runId}`,
    petName: `Warm Restart Pet ${runId}`
  };
  const webhook = await startVerificationWebhook(webhookPort);
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: database,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    KZT_ENABLE_PROCESS_SHUTDOWN_CONTROL: "true",
    CLOUD_PET_RELEASE_ID: releaseId,
    ADMIN_API_KEY: "cloud-pet-warm-restart-admin-key-2026",
    WEB_ORIGIN: webBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: `${apiBaseUrl}/api`,
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-warm-restart-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: webhook.url,
    MEMBER_AUTH_WEBHOOK_TOKEN: webhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-warm-restart-ops-token-with-more-than-32-chars",
    SQLITE_RECOVERY_STATUS_DIR: recoveryDirectory,
    SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "false",
    PAYMENT_TIMEOUT_MINUTES: "30",
    ADMIN_OWNER_NAME: owner.name,
    ADMIN_OWNER_EMAIL: owner.email,
    ADMIN_OWNER_PASSWORD: owner.password
  };
  const expectedConfig = computeCloudPetSafeConfigSha256(baseEnv);
  const bootstrapEnv = { ...baseEnv, [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: expectedConfig };
  const runtimeEnv = { ...bootstrapEnv };
  delete runtimeEnv.ADMIN_OWNER_NAME;
  delete runtimeEnv.ADMIN_OWNER_EMAIL;
  delete runtimeEnv.ADMIN_OWNER_PASSWORD;
  assertDrill(!runtimeEnv.ADMIN_OWNER_EMAIL && !runtimeEnv.ADMIN_OWNER_PASSWORD, "Runtime environment still contains bootstrap secrets");

  let api;
  let web;
  let originalNextEnv;
  let petNo;
  let diaryCountBeforeRestart;
  try {
    originalNextEnv = await readFile(nextEnvPath, "utf8");
    await writeFile(databasePath, "", { flag: "wx" });
    const migration = await runCommand(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], bootstrapEnv);
    assertDrill(migration.code === 0, "Warm-restart migration failed");
    const firstBootstrap = await runCommand(process.execPath, [bootstrapScript], bootstrapEnv);
    assertDrill(firstBootstrap.code === 0, "Warm-restart Owner bootstrap failed");
    const duplicateBootstrap = await runCommand(process.execPath, [bootstrapScript], bootstrapEnv);
    assertDrill(duplicateBootstrap.code !== 0, "Warm-restart duplicate Owner bootstrap unexpectedly succeeded");

    const webBuild = await runCommand(process.execPath, [nextCli, "build", "web"], runtimeEnv);
    assertDrill(webBuild.code === 0, "Warm-restart production web build failed");
    api = startProcess(
      process.execPath,
      [apiEntry],
      { ...runtimeEnv, PORT: String(apiPort) },
      true
    );
    await waitForApi(apiBaseUrl, api);
    web = startProcess(process.execPath, [nextCli, "start", "web", "-p", String(webPort), "-H", "127.0.0.1"], { ...runtimeEnv, PORT: String(webPort) });
    await waitForWeb(webBaseUrl, web);

    const browser = await chromium.launch({ headless: true });
    try {
      const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const memberPage = await memberContext.newPage();
      await loginMember(memberPage, webBaseUrl, webhook, member);
      await memberPage.getByTestId("cloud-create-pet-name").fill(member.petName);
      await memberPage.getByTestId("cloud-create-species").selectOption("dog");
      await memberPage.getByTestId("cloud-create-personality").fill("Warm-restart handover verification pet.");
      await memberPage.getByTestId("cloud-create-submit").click();
      await waitForVisible(memberPage.getByTestId("cloud-daily-panel"), "Warm-restart daily panel did not render");
      const careButton = memberPage.getByTestId("cloud-task-complete-daily-care");
      await waitForEnabled(careButton, "Warm-restart daily care task was not actionable");
      await careButton.click();
      await waitForVisible(memberPage.getByTestId("cloud-today-diary-present"), "Warm-restart care diary did not become visible");
      const memberSession = await memberPage.evaluate(() => localStorage.getItem("kzt_member_session"));
      assertDrill(memberSession, "Warm-restart member session was not created");
      const beforeProfile = await readMemberProfile(apiBaseUrl, memberSession);
      petNo = beforeProfile.pets[0].petNo;
      diaryCountBeforeRestart = beforeProfile.pets[0].timeline.filter((event) => event.type === "care_daily_diary").length;
      assertDrill(diaryCountBeforeRestart >= 1, "Warm-restart precondition did not contain a care diary");
      const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const adminPage = await adminContext.newPage();
      await loginOwner(adminPage, webBaseUrl, owner);
      await adminContext.close();
      await memberContext.close();
    } finally {
      await browser.close();
    }

    await stopProcessGracefully(api);
    api = undefined;
    await access(lockPath).then(() => { throw new Error("Warm-restart ownership lock was not released"); }).catch((error) => {
      if (error instanceof Error && error.message === "Warm-restart ownership lock was not released") throw error;
    });

    api = startProcess(
      process.execPath,
      [apiEntry],
      { ...runtimeEnv, PORT: String(apiPort) },
      true
    );
    await waitForApi(apiBaseUrl, api);
    const browserAfterRestart = await chromium.launch({ headless: true });
    try {
      const memberContext = await browserAfterRestart.newContext({ viewport: { width: 390, height: 844 } });
      const memberPage = await memberContext.newPage();
      await loginMember(memberPage, webBaseUrl, webhook, member);
      await waitForVisible(memberPage.getByTestId("cloud-daily-panel"), "Warm-restart pet was not visible after replacement runtime");
      await waitForVisible(memberPage.getByTestId("cloud-today-diary-present"), "Warm-restart diary was not visible after replacement runtime");
      const memberSession = await memberPage.evaluate(() => localStorage.getItem("kzt_member_session"));
      assertDrill(memberSession, "Warm-restart replacement member session was not created");
      const afterProfile = await readMemberProfile(apiBaseUrl, memberSession);
      assertDrill(afterProfile.pets[0].petNo === petNo, "Warm-restart replacement runtime returned a different pet");
      const adminContext = await browserAfterRestart.newContext({ viewport: { width: 1280, height: 900 } });
      const adminPage = await adminContext.newPage();
      await loginOwner(adminPage, webBaseUrl, owner);
      await adminContext.close();
      await memberContext.close();
    } finally {
      await browserAfterRestart.close();
    }

    const evidence = await verifyDatabase(database, owner.email, member.phone, petNo, diaryCountBeforeRestart);
    console.log(JSON.stringify({
      ok: true,
      code: "CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_PASSED",
      checks: {
        migratedFreshDatabase: true,
        bootstrapCreatedOneOwner: true,
        duplicateBootstrapRejected: true,
        runtimeOwnerSecretsPresent: false,
        runtimeAReady: true,
        runtimeAGracefullyStopped: true,
        ownershipReleasedBeforeRuntimeB: true,
        runtimeBReadyOnSameDatabase: true,
        ownerLoginBeforeAndAfterRestart: true,
        memberPetAndDiaryPersisted: true,
        ...evidence
      }
    }));
  } finally {
    await stopProcess(api);
    await stopProcess(web);
    await webhook.close();
    if (originalNextEnv !== undefined) await writeFile(nextEnvPath, originalNextEnv, "utf8");
    if (process.env.KEEP_CLOUD_PET_WARM_RESTART_DRILL !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

try {
  await main();
} catch {
  console.error(JSON.stringify({
    ok: false,
    code: "CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_FAILED"
  }));
  process.exitCode = 1;
}
