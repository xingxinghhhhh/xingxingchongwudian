import { validateEnvironment } from "./environment";

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
        "TRUST_PROXY_HOPS must be a non-negative integer"
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
});
