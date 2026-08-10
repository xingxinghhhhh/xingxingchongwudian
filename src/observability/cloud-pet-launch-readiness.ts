import { Injectable } from "@nestjs/common";
import { CloudPetDeploymentReadinessService } from "./cloud-pet-deployment-readiness";
import { CloudPetOpsMetricsService } from "./cloud-pet-ops-metrics";
import { SqliteRecoveryAutoRefreshService } from "./sqlite-recovery-auto-refresh";
import { SqliteRecoveryStatusService } from "./sqlite-recovery-status";

export type CloudPetLaunchReadinessAttentionCode =
  | "API_NOT_READY"
  | "CONFIG_BASELINE_UNCONFIGURED"
  | "CONFIG_BASELINE_MISMATCH"
  | "RELEASE_ID_UNCONFIGURED"
  | "DATABASE_MIGRATION_NOT_READY"
  | "RUNTIME_CRITICAL"
  | "RECOVERY_NOT_VERIFIED"
  | "BACKUP_STALE"
  | "AUTO_RECOVERY_SUPPRESSED";

export type CloudPetLaunchReadiness = {
  checkedAt: string;
  status: "passed" | "needs_attention";
  checks: {
    runtime: "passed" | "failed";
    dataProtection: "passed" | "failed";
    automation: "passed" | "attention";
  };
  attentionItems: Array<{ code: CloudPetLaunchReadinessAttentionCode }>;
};

@Injectable()
export class CloudPetLaunchReadinessService {
  constructor(
    private readonly deploymentReadinessService: CloudPetDeploymentReadinessService,
    private readonly cloudPetOpsMetricsService: CloudPetOpsMetricsService,
    private readonly sqliteRecoveryStatusService: SqliteRecoveryStatusService,
    private readonly sqliteRecoveryAutoRefreshService: SqliteRecoveryAutoRefreshService
  ) {}

  async getReadiness(): Promise<CloudPetLaunchReadiness> {
    const [deploymentReadiness, opsHealth, recoveryStatus] = await Promise.all([
      this.deploymentReadinessService.getReadiness(),
      this.cloudPetOpsMetricsService.getAdminHealthSnapshot(),
      this.sqliteRecoveryStatusService.getStatus()
    ]);
    const autoRefreshRuntime = this.sqliteRecoveryAutoRefreshService.getRuntimeStatus();
    const attentionCodes: CloudPetLaunchReadinessAttentionCode[] = [];

    if (deploymentReadiness.status !== "ready") {
      attentionCodes.push("API_NOT_READY");
    }
    if (deploymentReadiness.runtime.production) {
      if (deploymentReadiness.configBaseline.status === "unconfigured") {
        attentionCodes.push("CONFIG_BASELINE_UNCONFIGURED");
      } else if (deploymentReadiness.configBaseline.status === "mismatch") {
        attentionCodes.push("CONFIG_BASELINE_MISMATCH");
      }
      if (deploymentReadiness.release.status === "unidentified") {
        attentionCodes.push("RELEASE_ID_UNCONFIGURED");
      }
      if (deploymentReadiness.migrationCompatibility.status !== "compatible") {
        attentionCodes.push("DATABASE_MIGRATION_NOT_READY");
      }
    }
    if (opsHealth.status === "critical") {
      attentionCodes.push("RUNTIME_CRITICAL");
    }

    const dataProtectionReady =
      recoveryStatus.status === "recoverable" &&
      recoveryStatus.freshness === "fresh";
    if (!dataProtectionReady) {
      attentionCodes.push(
        recoveryStatus.status === "recoverable" && recoveryStatus.freshness === "stale"
          ? "BACKUP_STALE"
          : "RECOVERY_NOT_VERIFIED"
      );
    }

    const automationAttention =
      this.sqliteRecoveryAutoRefreshService.isEnabled() &&
      autoRefreshRuntime.suppressionActive;
    if (automationAttention) {
      attentionCodes.push("AUTO_RECOVERY_SUPPRESSED");
    }

    return {
      checkedAt: new Date().toISOString(),
      status: attentionCodes.length === 0 ? "passed" : "needs_attention",
      checks: {
        runtime:
          deploymentReadiness.status === "ready" && opsHealth.status === "healthy"
            ? "passed"
            : "failed",
        dataProtection: dataProtectionReady ? "passed" : "failed",
        automation: automationAttention ? "attention" : "passed"
      },
      attentionItems: attentionCodes.map((code) => ({ code }))
    };
  }
}
