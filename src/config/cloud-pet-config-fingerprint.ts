import { createHash } from "node:crypto";
import { resolveApiBodyLimit } from "./request-body";
import { resolveSqliteRecoveryMaxBackupAgeHours } from "./sqlite-recovery";
import { resolveSqliteRecoveryAutoRefreshEnabled } from "./sqlite-recovery-auto-refresh";

export const CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256 =
  "CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256";

export type CloudPetConfigBaselineStatus =
  | "matched"
  | "unconfigured"
  | "mismatch";

export type CloudPetSafeConfig = {
  nodeEnv: string;
  webOrigin: string;
  trustedProxyHops: number;
  apiBodyLimitBytes: number;
  persistenceMode: "prisma_sqlite" | "memory";
  memberAuthProvider: string;
  sqliteRecoveryMaxBackupAgeHours: number;
  sqliteRecoveryAutoRefreshEnabled: boolean;
};

type CloudPetConfigSource =
  | Record<string, unknown>
  | { get<T = unknown>(key: string): T | undefined };

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function readString(config: CloudPetConfigSource, key: string) {
  const value =
    "get" in config && typeof config.get === "function"
      ? config.get(key)
      : (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveWebOrigin(config: Record<string, unknown>) {
  const value = readString(config, "WEB_ORIGIN");
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

export function resolveCloudPetSafeConfig(
  config: CloudPetConfigSource = process.env
): CloudPetSafeConfig {
  const trustedProxyHopsValue = readString(config, "TRUST_PROXY_HOPS");
  const trustedProxyHops = trustedProxyHopsValue
    ? Number(trustedProxyHopsValue)
    : 0;
  const resolverConfig = {
    API_BODY_LIMIT_BYTES: readString(config, "API_BODY_LIMIT_BYTES"),
    SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: readString(
      config,
      "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS"
    ),
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: readString(
      config,
      "SQLITE_RECOVERY_AUTO_REFRESH_ENABLED"
    )
  };

  return {
    nodeEnv: readString(config, "NODE_ENV") || "development",
    webOrigin: resolveWebOrigin(config),
    trustedProxyHops: Number.isSafeInteger(trustedProxyHops)
      ? trustedProxyHops
      : 0,
    apiBodyLimitBytes: resolveApiBodyLimit(resolverConfig),
    persistenceMode:
      readString(config, "KZT_USE_MEMORY_STORE").toLowerCase() === "true" ||
      !readString(config, "DATABASE_URL")
        ? "memory"
        : "prisma_sqlite",
    memberAuthProvider: readString(config, "MEMBER_AUTH_PROVIDER") || "development",
    sqliteRecoveryMaxBackupAgeHours: resolveSqliteRecoveryMaxBackupAgeHours(
      resolverConfig
    ),
    sqliteRecoveryAutoRefreshEnabled: resolveSqliteRecoveryAutoRefreshEnabled(
      resolverConfig
    )
  };
}

export function computeCloudPetSafeConfigSha256(
  config: CloudPetConfigSource = process.env
) {
  const canonical = JSON.stringify(resolveCloudPetSafeConfig(config));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function resolveCloudPetExpectedSafeConfigSha256(
  config: CloudPetConfigSource = process.env
) {
  const expected = readString(config, CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256);
  if (!expected) return "";
  if (!SHA256_PATTERN.test(expected)) {
    throw new Error(
      `${CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256} must be 64 lowercase hexadecimal characters`
    );
  }
  return expected;
}

export function getCloudPetConfigBaselineStatus(
  config: CloudPetConfigSource = process.env
): CloudPetConfigBaselineStatus {
  const expected = resolveCloudPetExpectedSafeConfigSha256(config);
  if (!expected) return "unconfigured";
  return computeCloudPetSafeConfigSha256(config) === expected
    ? "matched"
    : "mismatch";
}
