import { CloudPetLaunchReadinessService } from "./cloud-pet-launch-readiness";

function createService(overrides: {
  deploymentStatus?: "ready" | "attention";
  production?: boolean;
  configBaseline?: "matched" | "unconfigured" | "mismatch";
  releaseId?: string | null;
  migrationCompatibility?: "compatible" | "mismatch" | "unavailable";
  opsStatus?: "healthy" | "critical";
  recoveryStatus?: "no_backup" | "backup_unverified" | "recoverable" | "drill_failed" | "unavailable";
  freshness?: "fresh" | "stale" | "unknown";
  autoRefreshEnabled?: boolean;
  suppressionActive?: boolean;
} = {}) {
  const releaseId = Object.prototype.hasOwnProperty.call(overrides, "releaseId")
    ? overrides.releaseId ?? null
    : overrides.production
      ? "release"
      : null;

  return new CloudPetLaunchReadinessService(
    {
      getReadiness: jest.fn().mockResolvedValue({
        status: overrides.deploymentStatus ?? "ready",
      runtime: { production: overrides.production ?? false },
        configBaseline: { status: overrides.configBaseline ?? "unconfigured" },
        release: {
          status: releaseId ? "identified" : "unidentified",
          id: releaseId
        },
        migrationCompatibility: {
          status: overrides.migrationCompatibility ?? "compatible"
        }
      })
    } as never,
    {
      getAdminHealthSnapshot: jest.fn().mockResolvedValue({
        status: overrides.opsStatus ?? "healthy"
      })
    } as never,
    {
      getStatus: jest.fn().mockResolvedValue({
        status: overrides.recoveryStatus ?? "recoverable",
        freshness: overrides.freshness ?? "fresh"
      })
    } as never,
    {
      isEnabled: jest.fn().mockReturnValue(overrides.autoRefreshEnabled ?? false),
      getRuntimeStatus: jest.fn().mockReturnValue({
        suppressionActive: overrides.suppressionActive ?? false
      })
    } as never
  );
}

describe("CloudPetLaunchReadinessService", () => {
  it("passes when all existing readiness signals are healthy", async () => {
    await expect(createService().getReadiness()).resolves.toMatchObject({
      status: "passed",
      checks: {
        runtime: "passed",
        dataProtection: "passed",
        automation: "passed"
      },
      attentionItems: []
    });
  });

  it("reports API readiness and runtime failures", async () => {
    await expect(
      createService({ deploymentStatus: "attention", opsStatus: "critical" }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      checks: { runtime: "failed" },
      attentionItems: [{ code: "API_NOT_READY" }, { code: "RUNTIME_CRITICAL" }]
    });
  });

  it("distinguishes unverified and stale recovery states", async () => {
    await expect(
      createService({ recoveryStatus: "backup_unverified", freshness: "unknown" }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      checks: { dataProtection: "failed" },
      attentionItems: [{ code: "RECOVERY_NOT_VERIFIED" }]
    });
    await expect(
      createService({ recoveryStatus: "recoverable", freshness: "stale" }).getReadiness()
    ).resolves.toMatchObject({
      attentionItems: [{ code: "BACKUP_STALE" }]
    });
  });

  it("flags only enabled automatic recovery suppression", async () => {
    await expect(
      createService({
        autoRefreshEnabled: true,
        suppressionActive: true
      }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      checks: { automation: "attention" },
      attentionItems: [{ code: "AUTO_RECOVERY_SUPPRESSED" }]
    });
    await expect(
      createService({ autoRefreshEnabled: false, suppressionActive: true }).getReadiness()
    ).resolves.toMatchObject({
      status: "passed",
      checks: { automation: "passed" },
      attentionItems: []
    });
  });

  it("flags an unconfigured or mismatched production baseline", async () => {
    await expect(
      createService({ production: true, configBaseline: "unconfigured" }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      attentionItems: [{ code: "CONFIG_BASELINE_UNCONFIGURED" }]
    });
    await expect(
      createService({ production: true, configBaseline: "mismatch" }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      attentionItems: [{ code: "CONFIG_BASELINE_MISMATCH" }]
    });
    await expect(
      createService({ production: true, configBaseline: "matched" }).getReadiness()
    ).resolves.toMatchObject({
      status: "passed",
      attentionItems: []
    });
  });

  it("flags only a missing production release id", async () => {
    await expect(
      createService({ production: true, configBaseline: "matched", releaseId: null }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      attentionItems: [{ code: "RELEASE_ID_UNCONFIGURED" }]
    });
    await expect(
      createService({ production: true, configBaseline: "matched", releaseId: "release-1" }).getReadiness()
    ).resolves.toMatchObject({
      status: "passed",
      attentionItems: []
    });
  });

  it("flags migration mismatch and unavailable states only in production", async () => {
    await expect(
      createService({
        production: true,
        configBaseline: "matched",
        migrationCompatibility: "mismatch"
      }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      attentionItems: [{ code: "DATABASE_MIGRATION_NOT_READY" }]
    });
    await expect(
      createService({
        production: true,
        configBaseline: "matched",
        migrationCompatibility: "unavailable"
      }).getReadiness()
    ).resolves.toMatchObject({
      status: "needs_attention",
      attentionItems: [{ code: "DATABASE_MIGRATION_NOT_READY" }]
    });
    await expect(
      createService({
        production: false,
        migrationCompatibility: "unavailable"
      }).getReadiness()
    ).resolves.toMatchObject({
      status: "passed",
      attentionItems: []
    });
  });
});
