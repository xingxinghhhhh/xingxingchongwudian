import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = resolve(import.meta.dirname, "..");
const apiEntry = resolve(rootDir, "dist/main.js");
const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
const bootstrapScript = resolve(rootDir, "scripts/bootstrap-admin-owner.mjs");
const schemaPath = resolve(rootDir, "prisma/schema.prisma");
const releaseId = "cloud-pet-sqlite-single-instance-smoke";
const webhookToken = "cloud-pet-single-instance-webhook-token";
const {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} = await import(
  pathToFileURL(resolve(rootDir, "dist/config/cloud-pet-config-fingerprint.js")).href
);

function assertSmoke(condition, message) {
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
    child.once("error", rejectRun);
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
  assertSmoke(port, "SQLite single-instance smoke could not allocate a port");
  return port;
}

function startApi(env) {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: rootDir,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
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

async function stopApi(api) {
  if (!api || api.child.exitCode !== null) return;
  api.child.kill();
  const exited = once(api.child, "exit");
  const timeout = new Promise((resolveTimeout) =>
    setTimeout(resolveTimeout, 5_000, "timeout")
  );
  if ((await Promise.race([exited, timeout])) === "timeout") {
    api.child.kill("SIGKILL");
    await once(api.child, "exit");
  }
}

async function waitForExit(api, timeoutMs = 20_000) {
  if (api.child.exitCode !== null) return;
  const exited = once(api.child, "exit");
  const timeout = new Promise((resolveTimeout) =>
    setTimeout(resolveTimeout, timeoutMs, "timeout")
  );
  assertSmoke(
    (await Promise.race([exited, timeout])) !== "timeout",
    "SQLite single-instance conflict process did not exit"
  );
}

async function requestReady(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
  const body = await response.json();
  return response.ok && body?.status === "ready" && body?.database?.connected === true;
}

async function waitForReady(api, port) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error("SQLite single-instance API exited before readiness");
    }
    try {
      if (await requestReady(port)) return;
    } catch {
      // The API may still be binding its port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error("SQLite single-instance API readiness timed out");
}

async function migrate(database, env) {
  const result = await runCommand(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schemaPath],
    { ...env, DATABASE_URL: database }
  );
  assertSmoke(
    result.code === 0,
    "SQLite single-instance migration failed"
  );
}

async function main() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cloud-pet-single-instance-"));
  const databasePath = join(temporaryDirectory, "primary.db");
  const separateDatabasePath = join(temporaryDirectory, "separate.db");
  const primaryDatabase = databaseUrl(databasePath);
  const separateDatabase = databaseUrl(separateDatabasePath);
  const primaryPort = await getAvailablePort();
  const conflictPort = await getAvailablePort();
  const separatePort = await getAvailablePort();
  const replacementPort = await getAvailablePort();
  const owner = {
    name: "SQLite Single Instance Owner",
    email: "sqlite-single-instance-owner@example.com",
    password: `sqlite-single-instance-owner-${Date.now()}`
  };
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: primaryDatabase,
    KZT_USE_MEMORY_STORE: "false",
    KZT_PRODUCTION_SMOKE: "true",
    CLOUD_PET_RELEASE_ID: releaseId,
    ADMIN_API_KEY: "cloud-pet-single-instance-admin-key-2026",
    WEB_ORIGIN: "http://127.0.0.1:1",
    TRUST_PROXY_HOPS: "1",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "cloud-pet-single-instance-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: "http://127.0.0.1:1/member-verification",
    MEMBER_AUTH_WEBHOOK_TOKEN: webhookToken,
    OPS_METRICS_TOKEN: "cloud-pet-single-instance-ops-token-with-more-than-32-chars",
    SQLITE_RECOVERY_STATUS_DIR: join(temporaryDirectory, "recovery"),
    SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "false",
    PAYMENT_TIMEOUT_MINUTES: "30",
    ADMIN_OWNER_NAME: owner.name,
    ADMIN_OWNER_EMAIL: owner.email,
    ADMIN_OWNER_PASSWORD: owner.password
  };
  const expectedConfig = computeCloudPetSafeConfigSha256(baseEnv);
  const bootstrapEnv = {
    ...baseEnv,
    [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: expectedConfig
  };
  const runtimeBaseEnv = { ...bootstrapEnv };
  delete runtimeBaseEnv.ADMIN_OWNER_NAME;
  delete runtimeBaseEnv.ADMIN_OWNER_EMAIL;
  delete runtimeBaseEnv.ADMIN_OWNER_PASSWORD;
  let firstApi;
  let conflictApi;
  let separateApi;
  let replacementApi;

  try {
    await writeFile(databasePath, "", { flag: "wx" });
    await writeFile(separateDatabasePath, "", { flag: "wx" });
    await migrate(primaryDatabase, bootstrapEnv);
    await migrate(separateDatabase, bootstrapEnv);

    const bootstrap = await runCommand(process.execPath, [bootstrapScript], {
      ...bootstrapEnv,
      DATABASE_URL: primaryDatabase
    });
    assertSmoke(bootstrap.code === 0, "SQLite single-instance Owner bootstrap failed");
    const separateBootstrap = await runCommand(process.execPath, [bootstrapScript], {
      ...bootstrapEnv,
      DATABASE_URL: separateDatabase
    });
    assertSmoke(
      separateBootstrap.code === 0,
      "SQLite separate-database Owner bootstrap failed"
    );

    firstApi = startApi({
      ...runtimeBaseEnv,
      DATABASE_URL: primaryDatabase,
      PORT: String(primaryPort)
    });
    await waitForReady(firstApi, primaryPort);

    conflictApi = startApi({
      ...runtimeBaseEnv,
      DATABASE_URL: primaryDatabase,
      PORT: String(conflictPort)
    });
    await waitForExit(conflictApi);
    assertSmoke(
      conflictApi.child.exitCode !== 0 &&
        conflictApi.getOutput().includes("SQLITE_RUNTIME_OWNERSHIP_CONFLICT"),
      "Second runtime did not fail closed on SQLite ownership conflict"
    );
    assertSmoke(await requestReady(primaryPort), "First runtime lost readiness during conflict");

    separateApi = startApi({
      ...runtimeBaseEnv,
      DATABASE_URL: separateDatabase,
      PORT: String(separatePort)
    });
    await waitForReady(separateApi, separatePort);

    await stopApi(firstApi);
    firstApi = undefined;
    replacementApi = startApi({
      ...runtimeBaseEnv,
      DATABASE_URL: primaryDatabase,
      PORT: String(replacementPort)
    });
    await waitForReady(replacementApi, replacementPort);

    console.log(
      JSON.stringify({
        ok: true,
        code: "CLOUD_PET_SQLITE_SINGLE_INSTANCE_PASSED",
        checks: {
          primaryRuntimeReady: true,
          secondRuntimeRejected: true,
          primaryRuntimeStayedReady: true,
          separateDatabaseRuntimeReady: true,
          replacementRuntimeReadyAfterRelease: true,
          runtimeOwnerSecretsPresent: false
        }
      })
    );
  } finally {
    await stopApi(firstApi);
    await stopApi(conflictApi);
    await stopApi(separateApi);
    await stopApi(replacementApi);
    if (process.env.KEEP_CLOUD_PET_SINGLE_INSTANCE_SMOKE !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

try {
  await main();
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      code: "CLOUD_PET_SQLITE_SINGLE_INSTANCE_FAILED"
    })
  );
  process.exitCode = 1;
}
