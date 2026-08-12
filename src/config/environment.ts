import { resolveApiBodyLimit } from "./request-body";
import { resolveOpsMetricsToken } from "./ops-metrics";
import { resolveSqliteRecoveryMaxBackupAgeHours } from "./sqlite-recovery";
import { resolveSqliteRecoveryAutoRefreshEnabled } from "./sqlite-recovery-auto-refresh";
import {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  resolveCloudPetExpectedSafeConfigSha256
} from "./cloud-pet-config-fingerprint";
import { CLOUD_PET_RELEASE_ID, resolveCloudPetReleaseId } from "./cloud-pet-release";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function validateEnvironment(config: Record<string, unknown>) {
  if (readString(config, CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256)) {
    resolveCloudPetExpectedSafeConfigSha256(config);
  }
  if (readString(config, CLOUD_PET_RELEASE_ID)) {
    resolveCloudPetReleaseId(config);
  }

  if (readString(config, "SQLITE_RECOVERY_AUTO_REFRESH_ENABLED")) {
    resolveSqliteRecoveryAutoRefreshEnabled(config);
  }

  if (readString(config, "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS")) {
    try {
      resolveSqliteRecoveryMaxBackupAgeHours(config);
    } catch (error) {
      if (readString(config, "NODE_ENV") !== "production") {
        throw error;
      }
    }
  }

  if (readString(config, "NODE_ENV") !== "production") {
    return config;
  }

  const errors: string[] = [];
  const databaseUrl = readString(config, "DATABASE_URL");
  const adminApiKey = readString(config, "ADMIN_API_KEY");
  const webOrigin = readString(config, "WEB_ORIGIN");
  const paymentTimeout = readString(config, "PAYMENT_TIMEOUT_MINUTES");
  const adminSessionTtl = readString(config, "ADMIN_SESSION_TTL_HOURS");
  const memberSessionTtl = readString(config, "MEMBER_SESSION_TTL_DAYS");
  const memberAuthProvider = readString(config, "MEMBER_AUTH_PROVIDER");
  const memberAuthCodeSecret = readString(config, "MEMBER_AUTH_CODE_SECRET");
  const memberAuthWebhookUrl = readString(config, "MEMBER_AUTH_WEBHOOK_URL");
  const memberAuthWebhookToken = readString(config, "MEMBER_AUTH_WEBHOOK_TOKEN");
  const memberAuthCodeTtl = readString(config, "MEMBER_AUTH_CODE_TTL_MINUTES");
  const memberAuthCooldown = readString(
    config,
    "MEMBER_AUTH_SEND_COOLDOWN_SECONDS"
  );
  const trustProxyHops = readString(config, "TRUST_PROXY_HOPS");
  const apiBodyLimit = readString(config, "API_BODY_LIMIT_BYTES");

  if (!databaseUrl) {
    errors.push("DATABASE_URL is required");
  }

  if (readString(config, "KZT_USE_MEMORY_STORE").toLowerCase() === "true") {
    errors.push("KZT_USE_MEMORY_STORE cannot be true");
  }

  if (adminApiKey.length < 24 || adminApiKey === "dev-admin-key") {
    errors.push("ADMIN_API_KEY must contain at least 24 non-default characters");
  }

  try {
    const parsedOrigin = new URL(webOrigin);
    const isHttp = parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:";
    const isOriginOnly = parsedOrigin.origin === webOrigin.replace(/\/$/, "");
    const allowSmokeLocalOrigin =
      readString(config, "KZT_PRODUCTION_SMOKE") === "true" &&
      parsedOrigin.protocol === "http:" &&
      LOCAL_HOSTNAMES.has(parsedOrigin.hostname.toLowerCase());

    if (
      !isHttp ||
      !isOriginOnly ||
      (LOCAL_HOSTNAMES.has(parsedOrigin.hostname.toLowerCase()) &&
        !allowSmokeLocalOrigin)
    ) {
      errors.push("WEB_ORIGIN must be a non-local HTTP(S) origin");
    }
  } catch {
    errors.push("WEB_ORIGIN must be a valid HTTP(S) origin");
  }

  if (
    paymentTimeout &&
    (!/^\d+$/.test(paymentTimeout) || Number(paymentTimeout) < 1)
  ) {
    errors.push("PAYMENT_TIMEOUT_MINUTES must be a positive integer");
  }

  if (
    adminSessionTtl &&
    (!/^\d+$/.test(adminSessionTtl) || Number(adminSessionTtl) < 1)
  ) {
    errors.push("ADMIN_SESSION_TTL_HOURS must be a positive integer");
  }

  if (
    memberSessionTtl &&
    (!/^\d+$/.test(memberSessionTtl) || Number(memberSessionTtl) < 1)
  ) {
    errors.push("MEMBER_SESSION_TTL_DAYS must be a positive integer");
  }

  if (memberAuthProvider !== "webhook") {
    errors.push("MEMBER_AUTH_PROVIDER must be webhook");
  }

  if (
    memberAuthCodeSecret.length < 32 ||
    memberAuthCodeSecret.includes("replace-with")
  ) {
    errors.push("MEMBER_AUTH_CODE_SECRET must contain at least 32 non-default characters");
  }

  try {
    const webhookUrl = new URL(memberAuthWebhookUrl);
    const allowSmokeHttp =
      readString(config, "KZT_PRODUCTION_SMOKE") === "true" &&
      webhookUrl.protocol === "http:" &&
      LOCAL_HOSTNAMES.has(webhookUrl.hostname.toLowerCase());

    if (webhookUrl.protocol !== "https:" && !allowSmokeHttp) {
      errors.push("MEMBER_AUTH_WEBHOOK_URL must be a secure HTTPS URL");
    }
  } catch {
    errors.push("MEMBER_AUTH_WEBHOOK_URL must be a valid URL");
  }

  if (
    memberAuthWebhookToken.length < 24 ||
    memberAuthWebhookToken.includes("replace-with")
  ) {
    errors.push("MEMBER_AUTH_WEBHOOK_TOKEN must contain at least 24 non-default characters");
  }

  if (
    memberAuthCodeTtl &&
    (!/^\d+$/.test(memberAuthCodeTtl) || Number(memberAuthCodeTtl) < 1)
  ) {
    errors.push("MEMBER_AUTH_CODE_TTL_MINUTES must be a positive integer");
  }

  if (
    memberAuthCooldown &&
    (!/^\d+$/.test(memberAuthCooldown) || Number(memberAuthCooldown) < 1)
  ) {
    errors.push("MEMBER_AUTH_SEND_COOLDOWN_SECONDS must be a positive integer");
  }

  if (!/^\d+$/.test(trustProxyHops)) {
    errors.push("TRUST_PROXY_HOPS must be a non-negative integer");
  }

  if (apiBodyLimit) {
    try {
      resolveApiBodyLimit(config);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "API_BODY_LIMIT_BYTES is invalid");
    }
  }

  try {
    resolveOpsMetricsToken(config);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "OPS_METRICS_TOKEN is invalid");
  }

  try {
    resolveSqliteRecoveryMaxBackupAgeHours(config);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS is invalid"
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid production environment:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`
    );
  }

  return config;
}
