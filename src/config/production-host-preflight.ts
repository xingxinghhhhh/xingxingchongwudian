import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { resolveSqliteDatabasePath } from "./sqlite-runtime-ownership";

export const DEFAULT_CLOUD_PET_API_PORT = 3000;
export const DEFAULT_CLOUD_PET_WEB_PORT = 3001;

function normalizeForComparison(value: string) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function resolveProductionSqliteDatabasePath(
  databaseUrl: string | undefined,
  rootDir = process.cwd()
) {
  const databasePath = resolveSqliteDatabasePath(databaseUrl);
  if (!databasePath) {
    throw new Error("DATABASE_URL must be a file: SQLite URL");
  }

  const normalizedDatabasePath = resolve(databasePath);
  const developmentDatabasePath = resolve(rootDir, "prisma", "dev.db");
  if (
    normalizeForComparison(normalizedDatabasePath) ===
    normalizeForComparison(developmentDatabasePath)
  ) {
    throw new Error("DATABASE_URL must not target prisma/dev.db");
  }

  return normalizedDatabasePath;
}

export function resolveProductionHostPorts(
  config: Record<string, unknown> = process.env
) {
  return {
    api: resolvePort(config.PORT, "PORT", DEFAULT_CLOUD_PET_API_PORT),
    web: resolvePort(config.WEB_PORT, "WEB_PORT", DEFAULT_CLOUD_PET_WEB_PORT)
  };
}

function resolvePort(value: unknown, key: string, fallback: number) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }

  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return port;
}

export function createSafeDatabaseIdentity(databasePath: string) {
  return createHash("sha256")
    .update(normalizeForComparison(databasePath), "utf8")
    .digest("hex")
    .slice(0, 16);
}

export function getDeclaredNodeRequirement(packageJson: Record<string, unknown>) {
  const engines = packageJson.engines;
  if (!engines || typeof engines !== "object" || Array.isArray(engines)) {
    return "not_declared";
  }
  const node = (engines as Record<string, unknown>).node;
  return typeof node === "string" && node.trim() ? node.trim() : "not_declared";
}

export function getSafeDatabaseFileLabel(databasePath: string) {
  return basename(databasePath);
}
