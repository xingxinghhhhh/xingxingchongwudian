import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const releaseId = "cloud-pet-cold-start-drill";
const webhookToken = "cloud-pet-cold-start-drill-webhook-token";
const {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} = await import(
  pathToFileURL(resolve(rootDir, "dist/config/cloud-pet-config-fingerprint.js")).href
);

function assertDrill(condition, message) {
  if (!condition) throw new Error(message);
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
  assertDrill(port, "Cold-start drill port allocation failed");
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
      throw new Error("Cold-start drill received invalid JSON");
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

async function waitForCode(webhook, phone) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const code = webhook.getCode(phone);
    if (code) return code;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Verification webhook did not receive the drill code");
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

async function verifyDatabase(database, ownerEmail, memberPhone) {
  const prisma = new PrismaClient({ datasourceUrl: database });
  try {
    const owners = await prisma.adminStaffAccount.findMany({
      where: { role: "owner", status: "active" },
      select: { email: true, name: true }
    });
    assertDrill(owners.length === 1, "Cold-start drill expected exactly one active Owner");
    assertDrill(owners[0].email === ownerEmail, "Cold-start drill Owner identity did not persist");

    const pets = await prisma.virtualPet.findMany({
      where: { ownerPhone: memberPhone },
      select: { id: true }
    });
    assertDrill(pets.length === 1, "Cold-start drill expected one member-owned cloud pet");
    const taskCompletions = await prisma.virtualPetTaskCompletion.count({
      where: { petId: pets[0].id }
    });
    const careDiaries = await prisma.virtualPetEvent.count({
      where: { petId: pets[0].id, type: "care_daily_diary" }
    });
    assertDrill(taskCompletions >= 1, "Cold-start drill did not persist a care task completion");
    assertDrill(careDiaries >= 1, "Cold-start drill did not persist a care diary");
    return { ownerCount: owners.length, petCount: pets.length, careTaskCount: taskCompletions, careDiaryCount: careDiaries };
  } finally {
    await prisma.$disconnect();
  }
}

async function runBrowserHandover(webBaseUrl, apiBaseUrl, webhook, owner, member) {
  const browser = await chromium.launch({ headless: true });
  const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const memberPage = await memberContext.newPage();
  let adminContext;
  try {
    await memberPage.goto(`${webBaseUrl}/cloud-pets`, { waitUntil: "domcontentloaded" });
    await memberPage.getByTestId("cloud-member-name").fill(member.name);
    await memberPage.getByTestId("cloud-member-phone").fill(member.phone);
    await memberPage.getByTestId("cloud-member-request-code").click();
    const code = await waitForCode(webhook, member.phone);
    await memberPage.getByTestId("cloud-member-code").fill(code);
    const syncButton = memberPage.getByTestId("cloud-member-sync");
    await waitForEnabled(syncButton, "Member sync button did not become enabled");
    await syncButton.click();
    await waitForVisible(memberPage.getByTestId("cloud-member-profile"), "Member login did not complete");

    await memberPage.getByTestId("cloud-create-pet-name").fill(member.petName);
    await memberPage.getByTestId("cloud-create-species").selectOption("dog");
    await memberPage.getByTestId("cloud-create-personality").fill("Cold-start handover verification pet.");
    await memberPage.getByTestId("cloud-create-submit").click();
    await waitForVisible(memberPage.getByText(member.petName, { exact: true }).first(), "Cloud pet creation did not complete");
    await waitForVisible(memberPage.getByTestId("cloud-daily-panel"), "Cloud pet daily panel did not render");

    const careButton = memberPage.getByTestId("cloud-task-complete-daily-care");
    await waitForEnabled(careButton, "Daily care task was not actionable");
    await careButton.click();
    await waitForVisible(memberPage.getByTestId("cloud-today-diary-present"), "Care diary did not become visible");

    adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${webBaseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    await adminPage.locator('input[type="email"]').fill(owner.email);
    await adminPage.locator('input[type="password"]').fill(owner.password);
    await adminPage.locator("form.admin-token-form button[type=submit]").click();
    await waitForVisible(adminPage.getByTestId("admin-member-verification-metrics"), "Owner Admin login did not complete");
    const adminSession = await adminPage.evaluate(() => localStorage.getItem("kzt_admin_session"));
    assertDrill(typeof adminSession === "string" && adminSession.startsWith("admin_"), "Admin StaffSession was not created");

    const authHeaders = { "x-admin-session": adminSession };
    const deployment = await requestJson(apiBaseUrl, "/api/admin/ops/deployment-readiness", { headers: authHeaders });
    assertDrill(deployment.response.ok && deployment.body?.status === "ready", "Deployment readiness did not pass");
    const recovery = await requestJson(apiBaseUrl, "/api/admin/ops/sqlite-recovery/run", { method: "POST", headers: authHeaders });
    assertDrill(recovery.response.ok, "SQLite recovery verification did not pass");
    const launch = await requestJson(apiBaseUrl, "/api/admin/ops/cloud-pet-launch-readiness", { headers: authHeaders });
    assertDrill(launch.response.ok && launch.body?.status === "passed", "Launch readiness did not pass");
    return { ownerLogin: true, memberLogin: true, cloudPetCreated: true, careDiaryVisible: true, deploymentReady: true, launchReady: true };
  } finally {
    await adminContext?.close();
    await memberContext.close();
    await browser.close();
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-pet-cold-start-handover-"));
  const databasePath = join(temporaryDirectory, "handover.db");
  const database = databaseUrl(databasePath);
  const apiPort = await getAvailablePort();
  const webPort = await getAvailablePort();
  const webhookPort = await getAvailablePort();
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const webBaseUrl = `http://127.0.0.1:${webPort}`;
  const recoveryDirectory = join(temporaryDirectory, "recovery");
  const runId = String(Date.now()).slice(-8);
  const owner = {
    name: "Cloud Pet Cold Start Owner",
    email: "cloud-pet-cold-start-owner@example.com",
    password: "cloud-pet-cold-start-owner-secret-2026"
  };
  const member = {
    name: `Cold Start Member ${runId}`,
    phone: `138${runId}`,
    petName: `Cold Start Pet ${runId}`
  };
  const webhook = await startVerificationWebhook(webhookPort);
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: database,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    CLOUD_PET_RELEASE_ID: releaseId,
    ADMIN_API_KEY: "cloud-pet-cold-start-admin-key-2026",
    WEB_ORIGIN: webBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: `${apiBaseUrl}/api`,
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-cold-start-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: webhook.url,
    MEMBER_AUTH_WEBHOOK_TOKEN: webhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-cold-start-ops-token-with-more-than-32-chars",
    SQLITE_RECOVERY_STATUS_DIR: recoveryDirectory,
    SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "false",
    PAYMENT_TIMEOUT_MINUTES: "30",
    PORT: String(apiPort),
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
  try {
    originalNextEnv = await readFile(nextEnvPath, "utf8");
    await writeFile(databasePath, "", { flag: "wx" });
    const migration = await runCommand(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], bootstrapEnv);
    assertDrill(migration.code === 0, `Migration deploy failed\n${migration.stderr}`);

    const emptyCheck = new PrismaClient({ datasourceUrl: database });
    const ownersBeforeBootstrap = await emptyCheck.adminStaffAccount.count({ where: { role: "owner", status: "active" } });
    await emptyCheck.$disconnect();
    assertDrill(ownersBeforeBootstrap === 0, "Cold-start drill database was not empty of active Owners");

    const firstBootstrap = await runCommand(process.execPath, [bootstrapScript], bootstrapEnv);
    assertDrill(firstBootstrap.code === 0, `Owner bootstrap failed\n${firstBootstrap.stderr}`);
    const duplicateBootstrap = await runCommand(process.execPath, [bootstrapScript], bootstrapEnv);
    assertDrill(duplicateBootstrap.code !== 0, "Duplicate Owner bootstrap unexpectedly succeeded");

    const afterBootstrap = new PrismaClient({ datasourceUrl: database });
    const ownersAfterBootstrap = await afterBootstrap.adminStaffAccount.count({ where: { role: "owner", status: "active" } });
    await afterBootstrap.$disconnect();
    assertDrill(ownersAfterBootstrap === 1, "Owner bootstrap did not remain one-time");

    const webBuild = await runCommand(process.execPath, [nextCli, "build", "web"], runtimeEnv);
    assertDrill(webBuild.code === 0, `Production web build failed\n${webBuild.stderr}`);
    api = startProcess(process.execPath, [apiEntry], runtimeEnv);
    await waitForApi(apiBaseUrl, api);
    const live = await requestJson(apiBaseUrl, "/api/health/live");
    assertDrill(live.response.ok, "Liveness did not pass");
    web = startProcess(process.execPath, [nextCli, "start", "web", "-p", String(webPort), "-H", "127.0.0.1"], { ...runtimeEnv, PORT: String(webPort) });
    await waitForWeb(webBaseUrl, web);
    const browserEvidence = await runBrowserHandover(webBaseUrl, apiBaseUrl, webhook, owner, member);
    const databaseEvidence = await verifyDatabase(database, owner.email, member.phone);
    console.log(JSON.stringify({
      ok: true,
      code: "CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED",
      checks: {
        emptyDatabaseMigrated: true,
        bootstrapCreatedOneOwner: true,
        duplicateBootstrapRejected: true,
        runtimeOwnerSecretsPresent: false,
        liveness: true,
        readiness: true,
        ...browserEvidence,
        ...databaseEvidence
      }
    }));
  } finally {
    await stopProcess(web);
    await stopProcess(api);
    await webhook.close();
    if (originalNextEnv !== undefined) await writeFile(nextEnvPath, originalNextEnv, "utf8");
    if (process.env.KEEP_CLOUD_PET_COLD_START_DRILL !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    code: "CLOUD_PET_COLD_START_HANDOVER_DRILL_FAILED",
    message: error instanceof Error ? error.message : "Unexpected cold-start drill failure"
  }));
  process.exitCode = 1;
});
