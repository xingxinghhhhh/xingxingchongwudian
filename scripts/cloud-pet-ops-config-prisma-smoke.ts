import { spawn, ChildProcess } from "node:child_process";
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse
} from "node:http";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  careScoreBonusFromProfile,
  canonicalizeCloudPetOpsConfig,
  CloudPetOpsConfigSnapshot
} from "./cloud-pet-ops-config-prisma-smoke.helpers";
import {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} from "../src/config/cloud-pet-config-fingerprint";

const rootDirectory = resolve(__dirname, "..");
const apiEntry = resolve(rootDirectory, "dist/main.js");
const prismaCli = resolve(rootDirectory, "node_modules/prisma/build/index.js");
const adminOwnerBootstrapScript = resolve(rootDirectory, "scripts/bootstrap-admin-owner.mjs");
const schemaPath = resolve(rootDirectory, "prisma/schema.prisma");
const memberWebhookToken = "cloud-pet-ops-config-smoke-webhook-token";

type ApiProcess = {
  child: ChildProcess;
};

type VerificationWebhook = {
  url: string;
  getCode: (phone: string) => string | undefined;
  close: () => Promise<void>;
};

type JsonResult = {
  response: Response;
  body: any;
};

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDirectory,
      env,
      windowsHide: true
    });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", () => undefined);
    child.once("error", () => rejectRun(new Error("Smoke command could not start")));
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error("Smoke command failed"));
      }
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
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  assertSmoke(port, "Smoke port allocation failed");
  return port;
}

async function startMemberVerificationWebhook(port: number): Promise<VerificationWebhook> {
  const codes = new Map<string, string>();
  const server = createHttpServer(
    (request: IncomingMessage, response: ServerResponse) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        try {
          if (
            request.method !== "POST" ||
            request.headers.authorization !== `Bearer ${memberWebhookToken}`
          ) {
            response.writeHead(401).end();
            return;
          }

          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            phone?: string;
            code?: string;
          };
          assertSmoke(payload.phone && payload.code, "Webhook payload was incomplete");
          codes.set(payload.phone, payload.code);
          response.writeHead(204).end();
        } catch {
          response.writeHead(400).end();
        }
      });
    }
  );

  server.listen(port, "127.0.0.1");
  await once(server, "listening");

  return {
    url: `http://127.0.0.1:${port}/member-verification`,
    getCode: (phone) => codes.get(phone),
    close: () =>
      new Promise<void>((resolveClose) => {
        if (!server.listening) {
          resolveClose();
          return;
        }
        server.close(() => resolveClose());
      })
  };
}

function startApi(env: NodeJS.ProcessEnv): ApiProcess {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: rootDirectory,
    env,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"]
  });
  return { child };
}

async function stopApi(api?: ApiProcess) {
  if (!api || api.child.exitCode !== null) return;
  api.child.kill();
  const exited = once(api.child, "exit");
  const timeout = new Promise<"timeout">((resolveTimeout) => {
    setTimeout(() => resolveTimeout("timeout"), 5_000);
  });
  if ((await Promise.race([exited.then(() => "exit" as const), timeout])) === "timeout") {
    api.child.kill("SIGKILL");
    await once(api.child, "exit");
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<JsonResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("API returned invalid JSON");
    }
  }
  return { response, body };
}

async function waitForReadiness(baseUrl: string, api: ApiProcess) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error("Cloud-pet operations config API exited before readiness");
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
  throw new Error("Cloud-pet operations config readiness timed out");
}

async function loginAdmin(baseUrl: string) {
  const result = await requestJson(baseUrl, "/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "cloud-pet-ops-config-owner@example.com",
      password: "cloud-pet-ops-config-owner-secret-2026"
    })
  });
  assertSmoke(
    result.response.ok &&
      result.body?.sessionToken &&
      result.body?.staff?.role === "owner",
    "Owner admin login failed"
  );
  return result.body.sessionToken as string;
}

async function loginMember(
  baseUrl: string,
  webhook: VerificationWebhook,
  phone: string
) {
  const verification = await requestJson(baseUrl, "/api/auth/verification-codes", {
    method: "POST",
    body: JSON.stringify({ name: "Cloud Pet Operations Smoke Member", phone })
  });
  assertSmoke(
    verification.response.ok && verification.body?.challengeId,
    "Member challenge failed"
  );
  const code = webhook.getCode(phone);
  assertSmoke(code, "Member verification webhook did not receive a code");

  const login = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ challengeId: verification.body.challengeId, code })
  });
  assertSmoke(login.response.ok && login.body?.sessionToken, "Member login failed");
  return login.body.sessionToken as string;
}

async function readConfig(baseUrl: string, adminSession: string) {
  const [tasks, rules] = await Promise.all([
    requestJson(baseUrl, "/api/admin/cloud-pets/growth-tasks", {
      headers: { "X-Admin-Session": adminSession }
    }),
    requestJson(baseUrl, "/api/admin/cloud-pets/care-score-rules", {
      headers: { "X-Admin-Session": adminSession }
    })
  ]);
  const dailyCare = tasks.body?.items?.find(
    (item: { key?: string }) => item.key === "daily-care"
  );
  assertSmoke(tasks.response.ok && dailyCare, "Daily-care template read failed");
  assertSmoke(rules.response.ok && rules.body, "Care score rules read failed");
  return canonicalizeCloudPetOpsConfig(dailyCare, rules.body);
}

async function patchConfig(
  baseUrl: string,
  adminSession: string,
  baseline: CloudPetOpsConfigSnapshot
) {
  const nextPoints = baseline.growthTask.points < 90
    ? baseline.growthTask.points + 7
    : baseline.growthTask.points - 7;
  const nextDailyTaskBonus = baseline.careScoreRules.dailyTaskBonus < 90
    ? baseline.careScoreRules.dailyTaskBonus + 7
    : baseline.careScoreRules.dailyTaskBonus - 7;

  const [taskUpdate, rulesUpdate] = await Promise.all([
    requestJson(baseUrl, "/api/admin/cloud-pets/growth-tasks/daily-care", {
      method: "PATCH",
      headers: { "X-Admin-Session": adminSession },
      body: JSON.stringify({ points: nextPoints })
    }),
    requestJson(baseUrl, "/api/admin/cloud-pets/care-score-rules", {
      method: "PATCH",
      headers: { "X-Admin-Session": adminSession },
      body: JSON.stringify({ dailyTaskBonus: nextDailyTaskBonus })
    })
  ]);
  assertSmoke(taskUpdate.response.ok, "Growth task template update failed");
  assertSmoke(rulesUpdate.response.ok, "Care score rules update failed");

  return {
    nextPoints,
    nextDailyTaskBonus,
    snapshot: await readConfig(baseUrl, adminSession)
  };
}

async function createPet(baseUrl: string, memberSession: string, phone: string) {
  const result = await requestJson(baseUrl, "/api/cloud-pets", {
    method: "POST",
    headers: { "X-Member-Token": memberSession },
    body: JSON.stringify({
      ownerName: "Cloud Pet Operations Smoke Member",
      ownerPhone: phone,
      name: "Ops Config Pet",
      species: "cat",
      personality: "validates persisted operations configuration"
    })
  });
  assertSmoke(result.response.ok && result.body?.petNo, "Cloud-pet creation failed");
  return result.body.petNo as string;
}

async function getPetProfile(baseUrl: string, petNo: string) {
  const result = await requestJson(baseUrl, `/api/cloud-pets/${petNo}`);
  assertSmoke(
    result.response.ok && result.body?.growth && result.body?.stats,
    "Cloud-pet profile read failed"
  );
  return result.body;
}

async function completeDailyCare(
  baseUrl: string,
  petNo: string,
  memberSession: string,
  expectedPoints: number,
  expectedBonus: number
) {
  const completion = await requestJson(
    baseUrl,
    `/api/cloud-pets/${petNo}/growth-tasks/daily-care/complete`,
    {
      method: "POST",
      headers: { "X-Member-Token": memberSession }
    }
  );
  assertSmoke(completion.response.status === 201, "Daily-care completion failed");
  assertSmoke(
    completion.body?.completedTask?.points === expectedPoints,
    "Daily-care completion did not use the persisted task points"
  );

  const profile = await getPetProfile(baseUrl, petNo);
  assertSmoke(
    careScoreBonusFromProfile(profile, expectedBonus),
    "Daily-care completion did not use the persisted care score bonus"
  );
  assertSmoke(profile.growth.todayCompletedTaskCount === 1, "Daily-care count was not persisted");
  assertSmoke(profile.growth.careStreakDays === 1, "Daily-care streak contract changed");
  return profile;
}

async function main() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "cloud-pet-ops-config-prisma-smoke-")
  );
  const databasePath = join(temporaryDirectory, "source.db");
  const database = databaseUrl(databasePath);
  const port = await getAvailablePort();
  const webhookPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: database,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    CLOUD_PET_RELEASE_ID: "cloud-pet-ops-config-smoke-release",
    ADMIN_API_KEY: "cloud-pet-ops-config-smoke-admin-key-2026",
    ADMIN_OWNER_NAME: "Cloud Pet Operations Smoke Owner",
    ADMIN_OWNER_EMAIL: "cloud-pet-ops-config-owner@example.com",
    ADMIN_OWNER_PASSWORD: "cloud-pet-ops-config-owner-secret-2026",
    ADMIN_SESSION_TTL_HOURS: "12",
    WEB_ORIGIN: "https://cloud-pet-ops-config-smoke.example.com",
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-ops-config-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_TOKEN: memberWebhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-ops-config-ops-metrics-token-with-more-than-32-chars",
    PORT: String(port)
  };
  env[CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256] = computeCloudPetSafeConfigSha256(env);
  let api: ApiProcess | undefined;
  let webhook: VerificationWebhook | undefined;
  let prisma: PrismaClient | undefined;

  try {
    await writeFile(databasePath, Buffer.alloc(0), { flag: "wx" });
    webhook = await startMemberVerificationWebhook(webhookPort);
    env.MEMBER_AUTH_WEBHOOK_URL = webhook.url;
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", schemaPath],
      env
    );
    await run(process.execPath, [adminOwnerBootstrapScript], env);

    api = startApi(env);
    await waitForReadiness(baseUrl, api);
    const adminSession = await loginAdmin(baseUrl);
    const memberPhone = `138${String(Date.now()).slice(-8)}`;
    const memberSession = await loginMember(baseUrl, webhook, memberPhone);
    const baseline = await readConfig(baseUrl, adminSession);
    const updated = await patchConfig(baseUrl, adminSession, baseline);

    prisma = new PrismaClient({ datasourceUrl: database });
    const [savedTask, savedRules] = await Promise.all([
      prisma.cloudPetGrowthTaskTemplate.findUnique({
        where: { key: "daily-care" }
      }),
      prisma.cloudPetCareScoreConfig.findUnique({
        where: { id: "active" }
      })
    ]);
    assertSmoke(
      savedTask?.points === updated.nextPoints &&
        savedRules?.dailyTaskBonus === updated.nextDailyTaskBonus,
      "Updated operations config was not persisted in Prisma"
    );

    const firstPetNo = await createPet(baseUrl, memberSession, memberPhone);
    await completeDailyCare(
      baseUrl,
      firstPetNo,
      memberSession,
      updated.nextPoints,
      updated.nextDailyTaskBonus
    );

    await stopApi(api);
    api = undefined;
    api = startApi(env);
    await waitForReadiness(baseUrl, api);

    const restoredAdmin = await requestJson(baseUrl, "/api/admin/auth/me", {
      headers: { "X-Admin-Session": adminSession }
    });
    assertSmoke(
      restoredAdmin.response.ok && restoredAdmin.body?.role === "owner",
      "Owner admin session did not survive API restart"
    );
    const restoredMember = await requestJson(baseUrl, "/api/members/me", {
      headers: { "X-Member-Token": memberSession }
    });
    assertSmoke(restoredMember.response.ok, "Member session did not survive API restart");

    const restoredConfig = await readConfig(baseUrl, adminSession);
    assertSmoke(
      JSON.stringify(restoredConfig) === JSON.stringify(updated.snapshot),
      "Operations config changed after API restart"
    );

    const secondPetNo = await createPet(baseUrl, memberSession, memberPhone);
    await completeDailyCare(
      baseUrl,
      secondPetNo,
      memberSession,
      updated.nextPoints,
      updated.nextDailyTaskBonus
    );

    await stopApi(api);
    api = undefined;
    const finalPrisma = prisma;
    assertSmoke(finalPrisma, "Final Prisma client was not initialized");
    const [finalTask, finalRules, taskCount, rulesCount] = await Promise.all([
      finalPrisma.cloudPetGrowthTaskTemplate.findUnique({
        where: { key: "daily-care" }
      }),
      finalPrisma.cloudPetCareScoreConfig.findUnique({
        where: { id: "active" }
      }),
      finalPrisma.cloudPetGrowthTaskTemplate.count({
        where: { key: "daily-care" }
      }),
      finalPrisma.cloudPetCareScoreConfig.count({
        where: { id: "active" }
      })
    ]);
    assertSmoke(
      finalTask?.points === updated.nextPoints &&
        finalRules?.dailyTaskBonus === updated.nextDailyTaskBonus &&
        taskCount === 1 &&
        rulesCount === 1,
      "Final Prisma operations config check failed"
    );

    console.log(
      JSON.stringify({
        ok: true,
        code: "CLOUD_PET_OPS_CONFIG_PRISMA_SMOKE_PASSED"
      })
    );
  } finally {
    await stopApi(api);
    await prisma?.$disconnect();
    await webhook?.close();
    if (process.env.KEEP_CLOUD_PET_OPS_CONFIG_PRISMA_SMOKE !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch(() => {
  console.error(
    JSON.stringify({
      ok: false,
      code: "CLOUD_PET_OPS_CONFIG_PRISMA_SMOKE_FAILED",
      message: "Cloud-pet operations config Prisma smoke failed"
    })
  );
  process.exitCode = 1;
});
