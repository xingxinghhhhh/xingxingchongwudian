import { ConfigService } from "@nestjs/config";
import { CloudPetDeploymentReadinessService } from "./cloud-pet-deployment-readiness";
import {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256
} from "../config/cloud-pet-config-fingerprint";

const productionConfig = {
  NODE_ENV: "production",
  DATABASE_URL: "file:./prisma/dev.db",
  KZT_USE_MEMORY_STORE: "false",
  ADMIN_API_KEY: "production-admin-key-with-more-than-24-chars",
  ADMIN_OWNER_EMAIL: "owner@example.com",
  ADMIN_OWNER_PASSWORD: "production-owner-password",
  WEB_ORIGIN: "https://pets.example.com",
  MEMBER_AUTH_PROVIDER: "webhook",
  MEMBER_AUTH_CODE_SECRET: "member-auth-code-secret-with-32-characters",
  MEMBER_AUTH_WEBHOOK_URL: "https://sms.example.com/send",
  MEMBER_AUTH_WEBHOOK_TOKEN: "member-auth-webhook-token-with-more-than-24-chars",
  TRUST_PROXY_HOPS: "1",
  OPS_METRICS_TOKEN: "production-ops-token-with-more-than-32-chars"
};

function createService(
  config: Record<string, string> = productionConfig,
  databaseStatus: {
    orm: string;
    provider: string;
    mode: string;
    configured: boolean;
  } = {
    orm: "prisma",
    provider: "sqlite",
    mode: "database",
    configured: true
  },
  readiness: {
    ready: boolean;
    database: {
      orm: string;
      provider: string;
      mode: string;
      configured: boolean;
      connected: boolean | null;
    };
  } = {
    ready: true,
    database: { ...databaseStatus, connected: true }
  },
  migrationCompatibility: "unavailable" | "mismatch" | "compatible" = "unavailable"
) {
  return new CloudPetDeploymentReadinessService(
    new ConfigService(config),
    {
      getStatus: jest.fn().mockReturnValue(databaseStatus),
      checkReadiness: jest.fn().mockResolvedValue(readiness)
    } as never,
    {
      getStatus: jest.fn().mockReturnValue({ status: migrationCompatibility })
    } as never
  );
}

describe("CloudPetDeploymentReadinessService", () => {
  it("returns a ready safe projection for a production Prisma instance", async () => {
    const result = await createService().getReadiness();

    expect(result).toEqual({
      status: "ready",
      runtime: { production: true },
      persistence: { mode: "prisma_sqlite", databaseReady: true },
      configuration: {
        adminAuthConfigured: true,
        memberWebhookConfigured: true,
        corsConfigured: true,
        trustedProxyConfigured: true,
        requestBodyLimitConfigured: true,
        opsMetricsConfigured: true,
        recoveryStatusDirectoryConfigured: false
      },
      configBaseline: { status: "unconfigured" },
      release: { status: "unidentified", id: null },
      migrationCompatibility: { status: "unavailable" }
    });
  });

  it("fails closed for memory mode even when the memory probe is ready", async () => {
    const result = await createService(
      { ...productionConfig, DATABASE_URL: "", KZT_USE_MEMORY_STORE: "true" },
      { orm: "prisma", provider: "sqlite", mode: "memory", configured: false },
      {
        ready: true,
        database: {
          orm: "prisma",
          provider: "sqlite",
          mode: "memory",
          configured: false,
          connected: null
        }
      }
    ).getReadiness();

    expect(result.status).toBe("attention");
    expect(result.persistence).toEqual({ mode: "memory", databaseReady: false });
  });

  it("marks an unavailable database as attention", async () => {
    const result = await createService(
      productionConfig,
      undefined,
      {
        ready: false,
        database: {
          orm: "prisma",
          provider: "sqlite",
          mode: "database",
          configured: true,
          connected: false
        }
      }
    ).getReadiness();

    expect(result.status).toBe("attention");
    expect(result.persistence).toEqual({ mode: "prisma_sqlite", databaseReady: false });
  });

  it("does not make the optional recovery directory a readiness requirement", async () => {
    const result = await createService().getReadiness();

    expect(result.status).toBe("ready");
    expect(result.configuration.recoveryStatusDirectoryConfigured).toBe(false);
  });

  it("marks missing required configuration as attention", async () => {
    const result = await createService({
      ...productionConfig,
      OPS_METRICS_TOKEN: ""
    }).getReadiness();

    expect(result.status).toBe("attention");
    expect(result.configuration.opsMetricsConfigured).toBe(false);
  });

  it("reports a matched or mismatched production configuration baseline", async () => {
    const expected = computeCloudPetSafeConfigSha256(productionConfig);
    const matched = await createService({
      ...productionConfig,
      [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: expected
    }).getReadiness();
    const mismatch = await createService({
      ...productionConfig,
      [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: "a".repeat(64)
    }).getReadiness();

    expect(matched.configBaseline).toEqual({ status: "matched" });
    expect(mismatch.configBaseline).toEqual({ status: "mismatch" });
    expect(mismatch.status).toBe("ready");
  });

  it("reports an identified production release without exposing other runtime data", async () => {
    const result = await createService({
      ...productionConfig,
      CLOUD_PET_RELEASE_ID: "cloud-pet-20260809.3"
    }).getReadiness();

    expect(result.release).toEqual({
      status: "identified",
      id: "cloud-pet-20260809.3"
    });
  });

  it("projects the migration compatibility snapshot without changing deployment status", async () => {
    const result = await createService(productionConfig, undefined, undefined, "compatible").getReadiness();
    expect(result.migrationCompatibility).toEqual({ status: "compatible" });
    expect(result.status).toBe("ready");

    await expect(
      createService(productionConfig, undefined, undefined, "mismatch").getReadiness()
    ).resolves.toMatchObject({
      status: "ready",
      migrationCompatibility: { status: "mismatch" }
    });
  });

  it("does not expose secrets or internal paths", async () => {
    const result = await createService({
      ...productionConfig,
      SQLITE_RECOVERY_STATUS_DIR: "C:\\private\\recovery"
    }).getReadiness();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("production-ops-token");
    expect(serialized).not.toContain("sms.example.com");
    expect(serialized).not.toContain("C:\\private\\recovery");
    expect(serialized).not.toContain("production-owner-password");
  });
});
