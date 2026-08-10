import { validateEnvironment } from "./environment";
import { CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256 } from "./cloud-pet-config-fingerprint";
import { CLOUD_PET_RELEASE_ID } from "./cloud-pet-release";

const validProductionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "mysql://shop_user:secret@db.example.com:3306/pet_shop",
  ADMIN_API_KEY: "a-strong-admin-key-with-24-chars",
  WEB_ORIGIN: "https://pets.example.com",
  ADMIN_OWNER_EMAIL: "owner@pets.example.com",
  ADMIN_OWNER_PASSWORD: "strong-owner-secret",
  MEMBER_AUTH_PROVIDER: "webhook",
  MEMBER_AUTH_CODE_SECRET: "member-auth-code-secret-with-32-characters",
  MEMBER_AUTH_WEBHOOK_URL: "https://sms.example.com/member-verification",
  MEMBER_AUTH_WEBHOOK_TOKEN: "member-auth-webhook-token-2026",
  OPS_METRICS_TOKEN: "ops-metrics-production-token-with-more-than-32-chars",
  TRUST_PROXY_HOPS: "1"
};

describe("validateEnvironment", () => {
  it("does not require production secrets in development or test", () => {
    const config = { NODE_ENV: "test", KZT_USE_MEMORY_STORE: "true" };

    expect(validateEnvironment(config)).toBe(config);
  });

  it("accepts a complete production environment", () => {
    expect(validateEnvironment(validProductionEnvironment)).toBe(
      validProductionEnvironment
    );
  });

  it("reports all missing production requirements together", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        KZT_USE_MEMORY_STORE: "true"
      })
    ).toThrow(
      [
        "DATABASE_URL is required",
        "KZT_USE_MEMORY_STORE cannot be true",
        "ADMIN_API_KEY must contain at least 24 non-default characters",
        "WEB_ORIGIN must be a valid HTTP(S) origin",
        "ADMIN_OWNER_EMAIL must be a valid email address",
        "ADMIN_OWNER_PASSWORD must contain at least 12 non-default characters",
        "MEMBER_AUTH_PROVIDER must be webhook",
        "MEMBER_AUTH_CODE_SECRET must contain at least 32 non-default characters",
        "MEMBER_AUTH_WEBHOOK_URL must be a valid URL",
        "MEMBER_AUTH_WEBHOOK_TOKEN must contain at least 24 non-default characters",
        "TRUST_PROXY_HOPS must be a non-negative integer",
        "OPS_METRICS_TOKEN is required in production"
      ].join("\n- ")
    );
  });

  it("rejects development credentials and local production origins", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        ADMIN_API_KEY: "dev-admin-key",
        ADMIN_OWNER_PASSWORD: "owner123456",
        WEB_ORIGIN: "http://localhost:3001"
      })
    ).toThrow("Invalid production environment");
  });

  it("allows a local web origin only for the explicit production smoke", () => {
    expect(
      validateEnvironment({
        ...validProductionEnvironment,
        KZT_PRODUCTION_SMOKE: "true",
        WEB_ORIGIN: "http://127.0.0.1:3001"
      })
    ).toEqual(
      expect.objectContaining({ KZT_PRODUCTION_SMOKE: "true" })
    );
  });

  it("continues to reject a local web origin in normal production", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        WEB_ORIGIN: "http://127.0.0.1:3001"
      })
    ).toThrow("WEB_ORIGIN must be a non-local HTTP(S) origin");
  });

  it("rejects an invalid payment timeout", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        PAYMENT_TIMEOUT_MINUTES: "0"
      })
    ).toThrow("PAYMENT_TIMEOUT_MINUTES must be a positive integer");
  });

  it("rejects an invalid admin session lifetime", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        ADMIN_SESSION_TTL_HOURS: "0"
      })
    ).toThrow("ADMIN_SESSION_TTL_HOURS must be a positive integer");
  });

  it("rejects an invalid member session lifetime", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        MEMBER_SESSION_TTL_DAYS: "0"
      })
    ).toThrow("MEMBER_SESSION_TTL_DAYS must be a positive integer");
  });

  it("rejects insecure production member verification settings", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        MEMBER_AUTH_PROVIDER: "development",
        MEMBER_AUTH_CODE_SECRET: "short",
        MEMBER_AUTH_WEBHOOK_URL: "http://localhost:3100/send",
        MEMBER_AUTH_WEBHOOK_TOKEN: "short"
      })
    ).toThrow("MEMBER_AUTH_PROVIDER must be webhook");
  });

  it("requires an explicit production proxy hop count", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        TRUST_PROXY_HOPS: "auto"
      })
    ).toThrow("TRUST_PROXY_HOPS must be a non-negative integer");
  });

  it("rejects an invalid production backup freshness window", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "0"
      })
    ).toThrow(
      "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS must be an integer between 1 and 720"
    );
  });

  it("rejects a non-strict SQLite auto-refresh switch", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "test",
        SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "1"
      })
    ).toThrow("SQLITE_RECOVERY_AUTO_REFRESH_ENABLED must be true or false");
  });

  it("rejects an invalid expected cloud-pet config fingerprint", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: "not-a-hash"
      })
    ).toThrow(
      "CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256 must be 64 lowercase hexadecimal characters"
    );
  });

  it("rejects an invalid production release id", () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        [CLOUD_PET_RELEASE_ID]: "release with spaces"
      })
    ).toThrow("CLOUD_PET_RELEASE_ID");
  });
});
