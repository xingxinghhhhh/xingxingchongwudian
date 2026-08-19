import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { validateEnvironment } from "../src/config/environment";
import {
  computeCloudPetSafeConfigSha256,
  getCloudPetConfigBaselineStatus
} from "../src/config/cloud-pet-config-fingerprint";
import {
  CLOUD_PET_RELEASE_ID,
  resolveCloudPetReleaseId
} from "../src/config/cloud-pet-release";
import { readCloudPetReleaseMarkerFile } from "../src/config/cloud-pet-release-marker";
import {
  acquireProductionSqliteRuntimeOwnership,
} from "../src/config/sqlite-runtime-ownership";
import {
  createSafeDatabaseIdentity,
  getDeclaredNodeRequirement,
  getSafeDatabaseFileLabel,
  resolveProductionHostPorts,
  resolveProductionSqliteDatabasePath
} from "../src/config/production-host-preflight";
import {
  resolvePrismaMigrationCompatibility,
  runPrismaMigrationDiff
} from "../src/observability/prisma-migration-compatibility";

const rootDir = resolve(__dirname, "..");
const preflightPassedCode = "CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_PASSED";
const preflightFailedCode = "CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_FAILED";

type Failure = { check: string; reason: string };

function assertProductionHost(condition: unknown, check: string, reason: string) {
  if (!condition) throw new PreflightFailure(check, reason);
}

class PreflightFailure extends Error {
  constructor(readonly check: string, readonly reason: string) {
    super(reason);
    this.name = "PreflightFailure";
  }
}

async function checkPortIsAvailable(port: number) {
  return new Promise<boolean>((resolvePort) => {
    const server = createServer();
    const finish = (available: boolean) => {
      server.removeAllListeners();
      if (server.listening) server.close(() => resolvePort(available));
      else resolvePort(available);
    };
    server.once("error", () => finish(false));
    server.listen(port, "127.0.0.1", () => finish(true));
  });
}

async function runDirectoryProbe(directory: string) {
  const probePath = join(directory, `.cloud-pet-host-preflight-${randomUUID()}.probe`);
  const payload = `cloud-pet-host-preflight:${randomUUID()}`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(probePath, "wx", 0o600);
    await handle.writeFile(payload, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    const persisted = await readFile(probePath, "utf8");
    assertProductionHost(persisted === payload, "data_directory_probe", "PROBE_READBACK_MISMATCH");
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(probePath, { force: true }).catch(() => undefined);
  }
}

async function checkMigrationCompatibility(databaseUrl: string) {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    return await resolvePrismaMigrationCompatibility({
      databaseConfigured: true,
      readMigrationState: () =>
        prisma.$queryRawUnsafe(
          'SELECT "finished_at", "rolled_back_at" FROM "_prisma_migrations"'
        ),
      runMigrationDiff: () => runPrismaMigrationDiff(databaseUrl, rootDir)
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function runPreflight() {
  const failures: Failure[] = [];
  const env = process.env;
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")) as Record<string, unknown>;

  if (env.NODE_ENV !== "production") {
    failures.push({ check: "environment", reason: "NODE_ENV_MUST_BE_PRODUCTION" });
  }
  try {
    validateEnvironment(env);
  } catch {
    failures.push({ check: "production_configuration", reason: "CONFIGURATION_INVALID" });
  }

  let databasePath: string;
  try {
    databasePath = resolveProductionSqliteDatabasePath(env.DATABASE_URL, rootDir);
    const databaseInfo = await stat(databasePath);
    assertProductionHost(databaseInfo.isFile(), "database_file", "DATABASE_FILE_NOT_REGULAR");
  } catch (error) {
    if (error instanceof PreflightFailure) failures.push({ check: error.check, reason: error.reason });
    else failures.push({ check: "database_file", reason: getDatabaseFailureReason(error) });
    databasePath = "";
  }

  let ports: { api: number; web: number } | undefined;
  try {
    ports = resolveProductionHostPorts(env);
    if (ports.api === ports.web) {
      failures.push({ check: "ports", reason: "API_WEB_PORT_CONFLICT" });
    }
    if (!(await checkPortIsAvailable(ports.api))) {
      failures.push({ check: "api_port", reason: "PORT_IN_USE" });
    }
    if (!(await checkPortIsAvailable(ports.web))) {
      failures.push({ check: "web_port", reason: "PORT_IN_USE" });
    }
  } catch {
    failures.push({ check: "ports", reason: "PORT_CONFIGURATION_INVALID" });
  }

  if (databasePath) {
    try {
      await runDirectoryProbe(resolve(databasePath, ".."));
    } catch (error) {
      failures.push({
        check: error instanceof PreflightFailure ? error.check : "data_directory_probe",
        reason: error instanceof PreflightFailure ? error.reason : "PROBE_FAILED"
      });
    }

    try {
      const ownership = acquireProductionSqliteRuntimeOwnership({
        production: true,
        databaseUrl: env.DATABASE_URL,
        useMemoryStore: env.KZT_USE_MEMORY_STORE
      });
      ownership.release();
      const lockPath = `${databasePath}.runtime.lock`;
      const lockInfo = await stat(lockPath).then(() => true).catch(() => false);
      assertProductionHost(!lockInfo, "sqlite_ownership", "OWNERSHIP_NOT_RELEASED");
    } catch {
      failures.push({ check: "sqlite_ownership", reason: "OWNERSHIP_UNAVAILABLE" });
    }
  }

  const releaseId = (() => {
    try {
      return resolveCloudPetReleaseId({ [CLOUD_PET_RELEASE_ID]: env[CLOUD_PET_RELEASE_ID] });
    } catch {
      failures.push({ check: "release_id", reason: "RELEASE_ID_INVALID" });
      return null;
    }
  })();
  const marker = readCloudPetReleaseMarkerFile(resolve(rootDir, "dist", "cloud-pet-release.json"));
  if (!releaseId || marker.status !== "identified" || marker.releaseId !== releaseId) {
    failures.push({ check: "release_marker", reason: "RELEASE_MARKER_MISMATCH" });
  }

  try {
    if (getCloudPetConfigBaselineStatus(env) !== "matched") {
      failures.push({ check: "safe_config_baseline", reason: "SAFE_CONFIG_BASELINE_NOT_MATCHED" });
    }
  } catch {
    failures.push({ check: "safe_config_baseline", reason: "SAFE_CONFIG_BASELINE_INVALID" });
  }

  if (!await stat(resolve(rootDir, "dist", "main.js")).then((info) => info.isFile()).catch(() => false)) {
    failures.push({ check: "api_artifact", reason: "API_BUILD_MISSING" });
  }
  if (!await stat(resolve(rootDir, "web", ".next", "BUILD_ID")).then((info) => info.isFile()).catch(() => false)) {
    failures.push({ check: "web_artifact", reason: "WEB_BUILD_MISSING" });
  }

  let migrationStatus: string = "not_checked";
  if (databasePath && failures.every(({ check }) => check !== "production_configuration" && check !== "database_file")) {
    try {
      const compatibility = await checkMigrationCompatibility(env.DATABASE_URL as string);
      migrationStatus = compatibility.status;
      if (compatibility.status !== "compatible") {
        failures.push({ check: "migration_compatibility", reason: compatibility.status.toUpperCase() });
      }
    } catch {
      failures.push({ check: "migration_compatibility", reason: "CHECK_FAILED" });
    }
  }

  const evidence = {
    timestamp: new Date().toISOString(),
    releaseId: releaseId ?? "unidentified",
    database: databasePath
      ? {
          identity: createSafeDatabaseIdentity(databasePath),
          file: getSafeDatabaseFileLabel(databasePath),
          parentProbe: !failures.some(({ check }) => check === "data_directory_probe")
        }
      : { identity: "unavailable", file: "unavailable", parentProbe: false },
    databaseIdentity: databasePath ? createSafeDatabaseIdentity(databasePath) : "unavailable",
    ports: ports
      ? {
          api: ports.api,
          web: ports.web,
          available: !failures.some(({ check }) => check === "api_port" || check === "web_port")
        }
      : { available: false },
    portsAvailable: ports
      ? !failures.some(({ check }) => check === "api_port" || check === "web_port")
      : false,
    configFingerprint: getConfigFingerprintForEvidence(env),
    node: {
      version: process.versions.node,
      declaredRequirement: getDeclaredNodeRequirement(packageJson)
    },
    configBaseline: getBaselineStatusForEvidence(env),
    migrationCompatibility: migrationStatus,
    failures
  };

  if (failures.length > 0) {
    const output = { ok: false, code: preflightFailedCode, evidence };
    await writeEvidenceFile(output);
    console.error(JSON.stringify(output));
    process.exitCode = 1;
    return;
  }

  const output = { ok: true, code: preflightPassedCode, evidence };
  await writeEvidenceFile(output);
  console.log(JSON.stringify(output));
}

async function writeEvidenceFile(output: { ok: boolean; code: string; evidence: Record<string, unknown> }) {
  const filePath = process.env.CLOUD_PET_EVIDENCE_FILE;
  if (!filePath) return;
  await writeFile(
    resolve(filePath),
    `${JSON.stringify({ schemaVersion: 1, kind: "hostPreflight", ...output }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
}

function getConfigFingerprintForEvidence(env: NodeJS.ProcessEnv) {
  try {
    return computeCloudPetSafeConfigSha256(env);
  } catch {
    return "unavailable";
  }
}

function getBaselineStatusForEvidence(env: NodeJS.ProcessEnv) {
  try {
    return getCloudPetConfigBaselineStatus(env);
  } catch {
    return "invalid";
  }
}

function getDatabaseFailureReason(error: unknown) {
  if (error instanceof Error && error.message.includes("prisma/dev.db")) {
    return "DEVELOPMENT_DATABASE_FORBIDDEN";
  }
  if (error instanceof Error && error.message.includes("file: SQLite")) {
    return "DATABASE_URL_NOT_SQLITE";
  }
  return "DATABASE_FILE_UNAVAILABLE";
}

runPreflight().catch(() => {
  const output = {
    ok: false,
    code: preflightFailedCode,
    evidence: { failures: [{ check: "preflight", reason: "UNEXPECTED_FAILURE" }] }
  };
  void writeEvidenceFile(output).finally(() => console.error(JSON.stringify(output)));
  process.exitCode = 1;
});
