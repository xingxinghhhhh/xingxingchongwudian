import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  addUtcDays,
  canonicalizeCloudPetPrismaState,
  CloudPetPrismaSmokeState
} from "./cloud-pet-prisma-smoke.helpers";

const rootDirectory = resolve(__dirname, "..");
const apiEntry = resolve(rootDirectory, "dist/main.js");
const prismaCli = resolve(rootDirectory, "node_modules/prisma/build/index.js");
const schemaPath = resolve(rootDirectory, "prisma/schema.prisma");
const memberWebhookToken = "cloud-pet-prisma-smoke-webhook-token";

type ApiProcess = {
  child: ChildProcessWithoutNullStreams;
  getOutput: () => string;
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
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-2_000);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-2_000);
  });

  return { child, getOutput: () => output };
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
      throw new Error("Cloud-pet Prisma smoke API exited before readiness");
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
  throw new Error("Cloud-pet Prisma smoke readiness timed out");
}

async function loginMember(baseUrl: string, webhook: VerificationWebhook, phone: string) {
  const verification = await requestJson(baseUrl, "/api/auth/verification-codes", {
    method: "POST",
    body: JSON.stringify({ name: "Cloud Pet Prisma Smoke Member", phone })
  });
  assertSmoke(verification.response.ok && verification.body?.challengeId, "Member challenge failed");
  const code = webhook.getCode(phone);
  assertSmoke(code, "Member verification webhook did not receive a code");

  const login = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ challengeId: verification.body.challengeId, code })
  });
  assertSmoke(login.response.ok && login.body?.sessionToken, "Member login failed");
  return login.body.sessionToken as string;
}

async function getPetProfile(baseUrl: string, petNo: string) {
  const result = await requestJson(baseUrl, `/api/cloud-pets/${petNo}`);
  assertSmoke(result.response.ok && result.body?.growth, "Cloud-pet profile read failed");
  return result.body;
}

function assertStableState(before: CloudPetPrismaSmokeState, after: CloudPetPrismaSmokeState) {
  assertSmoke(
    JSON.stringify(before) === JSON.stringify(after),
    "Cloud-pet state changed after idempotent replay"
  );
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-pet-prisma-smoke-"));
  const databasePath = join(temporaryDirectory, "source.db");
  const database = databaseUrl(databasePath);
  const port = await getAvailablePort();
  const webhookPort = await getAvailablePort();
  const webhook = await startMemberVerificationWebhook(webhookPort);
  const baseUrl = `http://127.0.0.1:${port}`;
  const businessDate = new Date().toISOString().slice(0, 10);
  const phone = `138${String(Date.now()).slice(-8)}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: database,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    ADMIN_API_KEY: "cloud-pet-prisma-smoke-admin-key-2026",
    ADMIN_OWNER_NAME: "Cloud Pet Smoke Owner",
    ADMIN_OWNER_EMAIL: "cloud-pet-smoke-owner@example.com",
    ADMIN_OWNER_PASSWORD: "cloud-pet-prisma-owner-secret-2026",
    WEB_ORIGIN: "https://cloud-pet-smoke.example.com",
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-prisma-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: webhook.url,
    MEMBER_AUTH_WEBHOOK_TOKEN: memberWebhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-prisma-ops-metrics-token-with-more-than-32-chars",
    PORT: String(port)
  };
  let api: ApiProcess | undefined;
  let prisma: PrismaClient | undefined;

  try {
    await writeFile(databasePath, Buffer.alloc(0), { flag: "wx" });
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", schemaPath],
      env
    );

    api = startApi(env);
    await waitForReadiness(baseUrl, api);
    const sessionToken = await loginMember(baseUrl, webhook, phone);
    const createPet = await requestJson(baseUrl, "/api/cloud-pets", {
      method: "POST",
      headers: { "X-Member-Token": sessionToken },
      body: JSON.stringify({
        ownerName: "Cloud Pet Prisma Smoke Member",
        ownerPhone: phone,
        name: "Prisma Smoke Pet",
        species: "cat",
        personality: "validates persistent daily care"
      })
    });
    assertSmoke(createPet.response.ok && createPet.body?.petNo, "Cloud-pet creation failed");
    const petNo = createPet.body.petNo as string;
    const before = canonicalizeCloudPetPrismaState(await getPetProfile(baseUrl, petNo));
    assertSmoke(before.autoDiaryCount === 0, "Fresh cloud pet already had an automatic diary");

    const completion = await requestJson(
      baseUrl,
      `/api/cloud-pets/${petNo}/growth-tasks/daily-care/complete`,
      {
        method: "POST",
        headers: { "X-Member-Token": sessionToken }
      }
    );
    assertSmoke(completion.response.status === 201, "Daily care completion failed");
    assertSmoke(completion.body?.completedTask?.key === "daily-care", "Unexpected care task completed");
    const after = canonicalizeCloudPetPrismaState(await getPetProfile(baseUrl, petNo));
    assertSmoke(after.completedTaskKeys.includes("daily-care"), "Daily care task was not persisted in the API state");
    assertSmoke(after.todayCompletedTaskCount === 1, "Daily care count was not persisted");
    assertSmoke(after.careStreakDays === 1, "First daily care did not create a one-day streak");
    assertSmoke(after.careScore > before.careScore, "Care score did not increase after daily care");
    assertSmoke(after.autoDiaryCount === 1, "Daily care did not create exactly one automatic diary");

    const memberProfile = await requestJson(baseUrl, "/api/members/me", {
      headers: { "X-Member-Token": sessionToken }
    });
    assertSmoke(memberProfile.response.ok, "Member session could not read the profile after care");

    await stopApi(api);
    api = undefined;
    api = startApi(env);
    await waitForReadiness(baseUrl, api);

    const restoredMember = await requestJson(baseUrl, "/api/members/me", {
      headers: { "X-Member-Token": sessionToken }
    });
    assertSmoke(restoredMember.response.ok, "Member session did not survive API restart");
    const restored = canonicalizeCloudPetPrismaState(await getPetProfile(baseUrl, petNo));
    assertStableState(after, restored);

    const replay = await requestJson(
      baseUrl,
      `/api/cloud-pets/${petNo}/growth-tasks/daily-care/complete`,
      {
        method: "POST",
        headers: { "X-Member-Token": sessionToken }
      }
    );
    assertSmoke(
      replay.response.status === 409 &&
        replay.body?.message === "Growth task already completed today",
      "Repeated daily care did not preserve the existing idempotency contract"
    );
    const afterReplay = canonicalizeCloudPetPrismaState(await getPetProfile(baseUrl, petNo));
    assertStableState(after, afterReplay);
    assertSmoke(new Date().toISOString().slice(0, 10) === businessDate, "Smoke crossed the business date boundary");

    await stopApi(api);
    api = undefined;
    prisma = new PrismaClient({ datasourceUrl: database });
    const petRecord = await prisma.virtualPet.findUnique({
      where: { petNo },
      select: { id: true }
    });
    assertSmoke(petRecord, "Final Prisma check could not find the cloud pet");
    const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
    const nextDay = new Date(`${addUtcDays(businessDate, 1)}T00:00:00.000Z`);
    const [completionCount, diaryCount] = await Promise.all([
      prisma.virtualPetTaskCompletion.count({
        where: { petNo, taskKey: "daily-care", completedDate: businessDate }
      }),
      prisma.virtualPetEvent.count({
        where: {
          petId: petRecord.id,
          type: "daily_diary",
          createdAt: { gte: dayStart, lt: nextDay }
        }
      })
    ]);
    assertSmoke(completionCount === 1, "Final Prisma check found duplicate daily care completion");
    assertSmoke(diaryCount === 1, "Final Prisma check found duplicate automatic diary");

    console.log(JSON.stringify({ ok: true, code: "CLOUD_PET_PRISMA_SMOKE_PASSED" }));
  } finally {
    await stopApi(api);
    await prisma?.$disconnect();
    await webhook.close();
    if (process.env.KEEP_CLOUD_PET_PRISMA_SMOKE !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      ok: false,
      code: "CLOUD_PET_PRISMA_SMOKE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected smoke failure"
    })
  );
  process.exitCode = 1;
});
